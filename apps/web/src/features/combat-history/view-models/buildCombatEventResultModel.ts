import type { CombatResultEnvelope, ProjectedCombatHistoryEvent } from "@glantri/domain";

import { measureCombatPerformanceStage } from "@/lib/performance/combatPerformance";

import { buildCombatCalculationPresentations } from "./buildCombatCalculationPresentations";
import {
  buildCombatCalculationPresentationRows,
  type CombatCalculationPresentation,
} from "./combatCalculationPresentation";
import {
  buildCombatResultGroups,
  type CombatResultGroupPresentation,
  type CombatResultLedgerFragmentInput,
} from "./combatResultLedgerPresentation";
import { formatObservationContestDifference } from "./formatObservationContestDifference";

export interface CombatEventResultItemModel {
  calculations: readonly CombatCalculationPresentation[];
  /** Compatibility rows derived from `calculations`; no renderer consumes arbitrary fact bags. */
  calculationRows: CombatEventResultFactRow[];
  completenessLabel?: string;
  envelope?: CombatResultEnvelope;
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
  /** Atomic top-level ledger entries. Built with the immutable archived presentation. */
  groups?: readonly CombatResultGroupPresentation[];
  /** Compatibility access to the canonical event fragments contained by `groups`. */
  items: CombatEventResultItemModel[];
}

const EVENT_TITLES: Record<ProjectedCombatHistoryEvent["type"], string> = {
  attack: "Attack",
  missile_readiness: "Missile preparation",
  action_skipped: "Skipped",
  combat_experience: "Combat Experience",
  continued_contact_maintenance: "Continued Contact — Maintenance",
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
  modifier_review: "Modifier review",
  parry: "Parry",
  offensive_parry_brawling: "Offensive Parry — Brawling",
  observation: "Observe Opponent",
  participant_su_review: "Participant SU review",
  effect_review: "Damage/effects review",
  round_boundary: "Round boundary",
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
  break_off_review: "Break Off review",
  break_off_roll: "Break Off Dodge roll",
  break_off_result: "Break Off result",
  break_off_committed: "Break Off committed",
  disarm_opened: "Disarm contact",
  disarm_roll: "Disarm roll",
  disarm_result: "Disarm result",
  disarm_committed: "Disarm committed",
};

function humanize(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
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
  const actor = identity(event, "actor");
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
    case "missile_readiness": {
      const status = factLabel(factValue(event, "status"));
      return {
        outcomeRows: resultRow(event, status ? `Status: ${status}` : undefined),
        summary: `${actor ?? "Participant"} worked on missile preparation.`,
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
          ? event.identities.find((candidate) => candidate.participantId === winnerParticipantId)
              ?.displayName
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
    case "continued_contact_maintenance": {
      const resolved = factValue(event, "resolved") === true;
      const maintained = factValue(event, "contactMaintained") === true;
      const outcome = factValue(event, "outcome");
      return {
        outcomeRows: resolved
          ? resultRow(
              event,
              maintained
                ? "Continued Contact maintained."
                : outcome === "tie"
                  ? "Tie — Continued Contact broken."
                  : "Continued Contact broken.",
            )
          : [],
        summary: resolved
          ? maintained
            ? "The defender remains Unbalanced. The controller chooses engagement distance for the next round."
            : "Unbalanced was removed. Ordinary distance control resumes."
          : `${roller ?? "Participant"} rolled Brawling.`,
      };
    }
    case "observation": {
      const status = factValue(event, "observationStatus");
      const noProgressReason = factValue(event, "observationNoProgressReason");
      const progress = factValue(event, "roundsTowardNextAttempt");
      const required = factValue(event, "requiredQualifyingRounds");
      if (status === "no_progress" || status === "progress" || status === "period_complete") {
        return {
          outcomeRows: [],
          summary:
            status === "no_progress"
              ? noProgressReason === "observer_hit"
                ? "No progress · observer was hit"
                : "No progress"
              : status === "period_complete"
                ? "Observation period complete · roll pending"
                : typeof progress === "number" && typeof required === "number"
                  ? `Progress ${progress} / ${required}`
                  : "Observation progress recorded",
        };
      }
      const candidate = factValue(event, "candidateBonus");
      const best = factValue(event, "bestBonusAfter");
      const difference = factValue(event, "difference");
      return {
        outcomeRows: [
          ...(typeof difference === "number"
            ? [
                {
                  key: `${event.id}:outcome:margin`,
                  text: formatObservationContestDifference(difference),
                },
              ]
            : []),
          ...(typeof candidate === "number"
            ? [
                {
                  key: `${event.id}:outcome:result`,
                  text: `Result +${candidate}%`,
                },
              ]
            : []),
          ...(typeof best === "number"
            ? [{ key: `${event.id}:outcome:best`, text: `Best +${best}%` }]
            : []),
        ],
        summary: `Observe Opponent${event.identities.find((identity) => identity.role === "target")?.displayName ? ` — ${event.identities.find((identity) => identity.role === "target")?.displayName}` : ""}.`,
      };
    }
    case "break_off_review":
      return {
        outcomeRows: [],
        summary: `The GM reviewed ${actor ? `${actor}'s ` : "the "}Break Off contest.`,
      };
    case "break_off_roll": {
      const finalTotal = factLabel(factValue(event, "finalTotal"));
      return {
        outcomeRows: resultRow(event, finalTotal ? `Dodge result: ${finalTotal}` : undefined),
        summary: `${roller ?? "Participant"} rolled Dodge for Break Off.`,
      };
    }
    case "break_off_result": {
      const difference = factLabel(factValue(event, "difference"));
      const escaped = factValue(event, "escaped");
      return {
        outcomeRows: resultRow(event, difference ? `Difference: ${difference}` : undefined),
        summary:
          escaped === true
            ? `${defender ?? "The escapee"} won the Break Off contest.`
            : `${attacker ?? "The attacker"} maintained the engagement.`,
      };
    }
    case "break_off_committed":
      return {
        outcomeRows: [],
        summary:
          factValue(event, "escaped") === true
            ? "Break Off committed; the pair disengaged."
            : "Break Off committed; the pair remains engaged.",
      };
    case "disarm_opened":
      return {
        outcomeRows: [],
        summary: `${actor ?? "The acting combatant"} established weapon contact for Disarm.`,
      };
    case "disarm_roll": {
      const total = factLabel(factValue(event, "finalTotal"));
      return {
        outcomeRows: resultRow(event, total ? `Result: ${total}` : undefined),
        summary: `${roller ?? "Participant"} rolled for Disarm.`,
      };
    }
    case "disarm_result": {
      const difference = factLabel(factValue(event, "difference"));
      const result = factLabel(factValue(event, "tableRowId", "result"));
      return {
        outcomeRows: resultRow(
          event,
          [result, difference ? `difference ${difference}` : undefined].filter(Boolean).join(" · "),
        ),
        summary: result ? `Disarm result: ${result}.` : "Disarm produced no effect.",
      };
    }
    case "disarm_committed":
      return {
        outcomeRows: [],
        summary:
          factValue(event, "disarmed") === true
            ? "Disarm committed; the exact weapon was dropped."
            : factValue(event, "unbalanced") === true
              ? "Disarm committed; the holder is Unbalanced."
              : "Disarm committed with no direct damage.",
      };
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
      const winnerParticipantId = factValue(event, "winnerParticipantId");
      const winner =
        typeof winnerParticipantId === "string"
          ? event.identities.find((candidate) => candidate.participantId === winnerParticipantId)
              ?.displayName
          : undefined;
      const safeResult = result && /participant[_ ]?[ab]/i.test(result) ? undefined : result;
      return {
        outcomeRows: [
          ...resultRow(
            event,
            winner ? `Winner: ${winner}` : safeResult ? `Result: ${safeResult}` : undefined,
          ),
          ...(distance
            ? [{ key: `${event.id}:outcome:distance`, text: `Proposed distance: ${distance}` }]
            : []),
        ],
        summary: winner
          ? `${winner} won the distance-control contest.`
          : "The distance-control contest was resolved.",
      };
    }
    case "distance_control_applied": {
      const applied = factLabel(factValue(event, "appliedDistance"));
      const previous = factLabel(factValue(event, "previousDistance"));
      const continuedContact = factValue(event, "reason") === "continued_contact";
      return {
        outcomeRows: [
          ...(applied
            ? [{ key: `${event.id}:outcome:applied`, text: `Applied distance: ${applied}` }]
            : []),
          ...(previous
            ? [{ key: `${event.id}:outcome:previous`, text: `Previous distance: ${previous}` }]
            : []),
          ...(continuedContact
            ? [{ key: `${event.id}:outcome:reason`, text: "Reason: Continued Contact" }]
            : []),
        ],
        summary: continuedContact
          ? `${attacker ?? "The controller"} chose the next-round engagement distance.`
          : "The next-round distance was applied.",
      };
    }
    case "health_check": {
      const result = factLabel(factValue(event, "resultLabel", "outcome"));
      return {
        outcomeRows: resultRow(event, result ? `Result: ${result}` : undefined),
        summary: `${roller ?? "Participant"} made a health check.`,
      };
    }
    case "participant_su_review": {
      const changeSummaries = factValue(event, "changeSummaries");
      return {
        outcomeRows: Array.isArray(changeSummaries)
          ? changeSummaries.length
            ? changeSummaries.flatMap((change, index) =>
                typeof change === "string"
                  ? [{ key: `${event.id}:outcome:change:${index}`, text: change }]
                  : [],
              )
            : resultRow(event, "No changes")
          : factValue(event, "changed") === false
            ? resultRow(event, "No changes")
            : [],
        summary: `${actor ?? "Participant"} completed SU review.`,
      };
    }
    case "modifier_review": {
      const changes = factValue(event, "changes");
      const changeRows = Array.isArray(changes)
        ? changes.flatMap((candidate, index) => {
            if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
            const change = candidate as Record<string, unknown>;
            const supportedChangeTypes = new Set([
              "added",
              "changed",
              "edited",
              "replaced",
              "removed",
              "expired",
              "consumed",
              "resolved",
              "retained",
              "rejected_proposal",
            ]);
            const changeType =
              typeof change.changeType === "string" && supportedChangeTypes.has(change.changeType)
                ? change.changeType
                : undefined;
            const category = typeof change.category === "string" ? change.category : "Modifier";
            const label = typeof change.label === "string" ? change.label : category;
            const value = typeof change.value === "number" ? change.value : undefined;
            const previousValue =
              typeof change.previousValue === "number" ? change.previousValue : undefined;
            const duration = typeof change.duration === "string" ? change.duration : undefined;
            const previousDuration =
              typeof change.previousDuration === "string" ? change.previousDuration : undefined;
            const unit = typeof change.unit === "string" ? change.unit : undefined;
            if (!changeType) return [];
            const formattedValue = (candidateValue: number) => {
              const signed = `${candidateValue >= 0 ? "+" : ""}${candidateValue}`;
              if (unit === "percentage") return `${signed}%`;
              if (unit === "flat_db") return `${signed} DB`;
              if (unit === "damage") return `${signed} damage`;
              if (unit === "bleed_rate") return `${signed} HP/round`;
              return signed;
            };
            const valueChange =
              previousValue !== undefined && value !== undefined && previousValue !== value
                ? `${formattedValue(previousValue)} → ${formattedValue(value)}`
                : value !== undefined
                  ? formattedValue(value)
                  : undefined;
            const durationChange =
              previousDuration && duration && previousDuration !== duration
                ? `${previousDuration} → ${duration}`
                : duration;
            const detail =
              changeType === "removed"
                ? "removed"
                : changeType === "expired"
                  ? "expired"
                  : changeType === "consumed"
                    ? "consumed"
                    : changeType === "resolved"
                      ? "resolved"
                      : changeType === "retained"
                        ? "retained by GM"
                        : changeType === "rejected_proposal"
                          ? "automatic change rejected"
                          : changeType === "replaced"
                            ? "replaced"
                            : [valueChange, durationChange].filter(Boolean).join(" · ") ||
                              changeType;
            return [
              {
                key: `${event.id}:outcome:change:${index}`,
                text: `${label}${label === category ? "" : ` (${category})`}: ${detail}`,
              },
            ];
          })
        : [];
      const acceptedModifiers = factValue(event, "acceptedModifiers");
      const rows = Array.isArray(acceptedModifiers)
        ? acceptedModifiers.flatMap((candidate, index) => {
            if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
            const modifier = candidate as Record<string, unknown>;
            const category = typeof modifier.category === "string" ? modifier.category : "Modifier";
            const total = typeof modifier.total === "number" ? modifier.total : undefined;
            return total === undefined
              ? []
              : [
                  {
                    key: `${event.id}:outcome:modifier:${index}`,
                    text: `${category}: ${total >= 0 ? "+" : ""}${total}`,
                  },
                ];
          })
        : [];
      return {
        outcomeRows: changeRows.length
          ? changeRows
          : factValue(event, "changed") === false
            ? resultRow(event, "No changes")
            : rows.length
              ? rows
              : resultRow(event, factLabel(factValue(event, "resultLabel"))),
        summary: `${actor ?? "Participant"} completed modifier review.`,
      };
    }
    case "action_skipped": {
      const reason = factLabel(factValue(event, "reason"));
      return {
        outcomeRows: resultRow(event, reason ? `Reason: ${reason}` : "No action"),
        summary: `${actor ?? "Participant"} was skipped.`,
      };
    }
    case "effect_review":
      return {
        outcomeRows: resultRow(event, "Review completed"),
        summary: `${actor ?? defender ?? "Participant"} completed damage/effects review.`,
      };
    case "round_boundary": {
      const resolutionType = factValue(event, "resolutionType");
      return {
        outcomeRows: [],
        summary:
          resolutionType === "round_completed"
            ? `Round ${event.roundNumber} completed.`
            : "Combat boundary advanced.",
      };
    }
    case "initiative": {
      const total = factLabel(factValue(event, "total"));
      const resolutionType = factValue(event, "resolutionType");
      if (resolutionType === "bulk_skipped") {
        return {
          outcomeRows: resultRow(event, "Effective initiative: 0"),
          summary: `${roller ?? "Participant"} initiative was bulk skipped by GM.`,
        };
      }
      if (resolutionType === "gm_skipped") {
        return {
          outcomeRows: resultRow(event, "Effective initiative: 0"),
          summary: `${roller ?? "Participant"} initiative was skipped by GM.`,
        };
      }
      return {
        outcomeRows: resultRow(event, total ? `Total: ${total}` : undefined),
        summary: `${roller ?? "Participant"} rolled initiative.`,
      };
    }
    case "declaration": {
      const action = factLabel(factValue(event, "actionLabel"));
      const secondary = factLabel(factValue(event, "secondaryActionLabel"));
      const movement = factLabel(factValue(event, "movementLabel"));
      const submittedBy = factValue(event, "submittedBy");
      const target = identity(event, "target");
      return {
        outcomeRows: [
          ...resultRow(event, action ? `Action: ${action}` : undefined),
          ...(secondary
            ? [{ key: `${event.id}:outcome:secondary`, text: `Secondary action: ${secondary}` }]
            : []),
          ...(movement
            ? [{ key: `${event.id}:outcome:movement`, text: `Movement: ${movement}` }]
            : []),
          ...(target ? [{ key: `${event.id}:outcome:target`, text: `Target: ${target}` }] : []),
          ...(submittedBy === "gm" || submittedBy === "player"
            ? [
                {
                  key: `${event.id}:outcome:submitted-by`,
                  text: `Declared by: ${submittedBy === "gm" ? "GM" : "Player"}`,
                },
              ]
            : []),
        ],
        summary: `${actor ?? attacker ?? "Participant"} declared an action.`,
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
      return {
        outcomeRows: resultRow(
          event,
          response === "allow"
            ? `${defender ?? "Defender"} allowed the distance adjustment.`
            : `${defender ?? "Defender"} opposed the distance adjustment.`,
        ),
        summary: "The defender responded to the maneuver.",
      };
    }
    case "adjust_distance_adjustment":
      return { outcomeRows: [], summary: "The GM confirmed the maneuver adjustment." };
    case "adjust_distance_roll": {
      const side = factLabel(factValue(event, "side"));
      const outcome =
        side?.toLowerCase() === "defender"
          ? "to resist the distance adjustment"
          : "to adjust distance";
      return {
        outcomeRows: [],
        summary: `${roller ?? attacker ?? defender ?? "Participant"} rolled Dodge ${outcome}.`,
      };
    }
    case "adjust_distance_result": {
      const proposed = factValue(event, "standardProposedDistance");
      return {
        outcomeRows:
          typeof proposed === "number" ? resultRow(event, `Proposed distance: ${proposed}.`) : [],
        summary: "The maneuver proposal was resolved.",
      };
    }
    case "adjust_distance_committed": {
      const previous = factValue(event, "previousDistance");
      const committed = factValue(event, "committedDistance");
      return {
        outcomeRows:
          typeof committed === "number"
            ? resultRow(
                event,
                previous === committed
                  ? `Distance remained ${committed}.`
                  : `Distance changed from ${previous} to ${committed}.`,
              )
            : [],
        summary: "The GM committed the distance adjustment.",
      };
    }
  }
}

export function buildCombatEventResultModel(
  sourceEvents: readonly ProjectedCombatHistoryEvent[],
  instrumentation?: {
    calculationStage?: string;
    resultStage?: string;
  },
): CombatEventResultModel {
  // Boundary advancement is workflow provenance, not a participant combat result. Keep the
  // projected event available to history/Combat Log consumers without rendering it in Results.
  const events = sourceEvents.filter((event) => event.type !== "round_boundary");
  const canonicalResolvedObservationEventByAttemptId = new Map<string, string>();
  const resolvedObservationAttemptIds = new Set(
    events.flatMap((event) => {
      const attemptId = factValue(event, "observationAttemptId");
      const resolved =
        event.type === "observation" &&
        typeof attemptId === "string" &&
        factValue(event, "difference") !== undefined;
      if (resolved) {
        const existingId = canonicalResolvedObservationEventByAttemptId.get(attemptId);
        const existing = existingId
          ? events.find((candidate) => candidate.id === existingId)
          : undefined;
        const eventDetail =
          Number(event.facts.privateCalculation !== undefined) +
          Number(event.facts.gmReview?.targetCalculation !== undefined);
        const existingDetail = existing
          ? Number(existing.facts.privateCalculation !== undefined) +
            Number(existing.facts.gmReview?.targetCalculation !== undefined)
          : -1;
        if (!existing || eventDetail >= existingDetail) {
          canonicalResolvedObservationEventByAttemptId.set(attemptId, event.id);
        }
      }
      return resolved ? [attemptId] : [];
    }),
  );
  const items = [...events]
    .filter((event) => {
      if (
        event.type === "participant_su_review" &&
        (event.status === "proposed" ||
          factValue(event, "workflowOnly") === true ||
          factValue(event, "changed") === false)
      ) {
        return false;
      }
      const attemptId = factValue(event, "observationAttemptId");
      if (
        event.type === "observation" &&
        typeof attemptId === "string" &&
        factValue(event, "difference") !== undefined &&
        canonicalResolvedObservationEventByAttemptId.get(attemptId) !== event.id
      ) {
        return false;
      }
      return !(
        event.type === "observation" &&
        factValue(event, "observationStatus") === "period_complete" &&
        typeof attemptId === "string" &&
        resolvedObservationAttemptIds.has(attemptId)
      );
    })
    .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id))
    .map((event) => {
      const presentation = instrumentation?.resultStage
        ? measureCombatPerformanceStage(
            instrumentation.resultStage,
            () => eventPresentation(event),
            { eventType: event.type },
          )
        : eventPresentation(event);
      const calculations = instrumentation?.calculationStage
        ? measureCombatPerformanceStage(
            instrumentation.calculationStage,
            () => buildCombatCalculationPresentations(event),
            { eventType: event.type },
          )
        : buildCombatCalculationPresentations(event);
      const calculationRows = calculations.flatMap((calculation) =>
        buildCombatCalculationPresentationRows(calculation).map((row) => ({
          key: row.key,
          text: row.text,
        })),
      );
      return {
        calculations,
        calculationRows,
        completenessLabel:
          event.completeness === "complete"
            ? undefined
            : event.completeness === "legacy_derived"
              ? "Legacy-derived history"
              : "Incomplete history",
        envelope: event.resultEnvelope,
        id: event.id,
        outcomeRows: presentation.outcomeRows,
        sequence: event.sequence,
        summary: presentation.summary,
        title: EVENT_TITLES[event.type],
        type: event.type,
      };
    });
  const eventById = new Map(events.map((event) => [event.id, event]));
  const fragments: CombatResultLedgerFragmentInput[] = items.map((item) => {
    const event = eventById.get(item.id);
    const actor = item.envelope?.actor;
    const target = item.envelope?.targets[0];
    return {
      actionInstanceId: item.envelope?.actionInstanceId,
      result: {
        actor: actor
          ? {
              hidden: actor.visibility === "unseen",
              id: actor.participantId,
              label: actor.displayName,
            }
          : undefined,
        calculations: item.calculations,
        completenessLabel: item.completenessLabel,
        heading: item.title,
        id: item.id,
        outcomeRows: item.outcomeRows,
        resultEnvelopes: item.envelope ? [item.envelope] : [],
        sequence: item.sequence,
        sourceEventIds: [item.id],
        state: event?.status === "proposed" ? "pending" : "final",
        summary: item.summary,
        target: target
          ? {
              hidden: target.visibility === "unseen",
              id: target.participantId,
              label: target.displayName,
            }
          : undefined,
      },
    };
  });
  return {
    groups: buildCombatResultGroups(fragments),
    items,
  };
}
