import type { ProjectedCombatHistoryEvent } from "@glantri/domain";

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
  participant_su_review: "Participant SU review",
};

function humanize(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function formatValue(value: unknown, identityById: ReadonlyMap<string, string>): string {
  if (Array.isArray(value)) return value.map((entry) => formatValue(entry, identityById)).join(", ");
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => `${humanize(key)} ${formatValue(nested, identityById)}`)
      .join(" · ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === undefined || value === null || value === "") return "—";
  return typeof value === "string" ? (identityById.get(value) ?? value) : String(value);
}

function factRows(
  category: "calculation" | "involved" | "public",
  eventId: string,
  facts: Record<string, unknown> | undefined,
  identityById: ReadonlyMap<string, string>,
): CombatEventResultFactRow[] {
  if (!facts) return [];
  return Object.entries(facts).map(([fieldKey, value], index) => ({
    key: `${eventId}:${category}:${fieldKey}:${index}`,
    text: `${humanize(fieldKey)}: ${formatValue(value, identityById)}`,
  }));
}

function identity(event: ProjectedCombatHistoryEvent, role: string): string | undefined {
  return event.identities.find((candidate) => candidate.role === role)?.displayName;
}

function eventSummary(event: ProjectedCombatHistoryEvent): string {
  const attacker = identity(event, "attacker") ?? identity(event, "actor");
  const defender = identity(event, "defender") ?? identity(event, "target");
  const roller = identity(event, "roller") ?? identity(event, "actor");

  switch (event.type) {
    case "attack":
      return attacker && defender ? `${attacker} attacked ${defender}.` : "Attack recorded.";
    case "parry":
      return defender && attacker
        ? `${defender} attempted to parry ${attacker}.`
        : `${roller ?? "Defender"} attempted to parry.`;
    case "hit_location":
      return attacker && defender
        ? `Hit location resolved for ${attacker}'s attack on ${defender}.`
        : "Hit location resolved.";
    case "critical":
      return defender ? `Critical result resolved against ${defender}.` : "Critical result resolved.";
    case "damage_proposed":
      return defender ? `Damage proposed for ${defender}.` : "Damage proposed.";
    case "damage_committed":
      return defender ? `Damage committed against ${defender}.` : "Damage committed.";
    case "distance_control_roll":
      return roller && defender
        ? `${roller} rolled distance control against ${defender}.`
        : `${roller ?? "Participant"} rolled distance control.`;
    case "distance_control_result":
      return "Distance-control pair result resolved.";
    case "distance_control_applied":
      return "The next-round distance was applied.";
    case "health_check":
      return `${roller ?? "Participant"} made a health check.`;
    case "participant_su_review":
      return `${attacker ?? "Participant"} completed SU review.`;
    case "initiative":
      return `${roller ?? "Participant"} rolled initiative.`;
    case "declaration":
      return `${attacker ?? "Participant"} declared an action.`;
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
        return {
          calculationRows: factRows(
            "calculation",
            event.id,
            event.facts.privateCalculation,
            identityById,
          ),
          completenessLabel:
            event.completeness === "complete"
              ? undefined
              : event.completeness === "legacy_derived"
                ? "Legacy-derived history"
                : "Incomplete history",
          id: event.id,
          outcomeRows: [
            ...factRows("public", event.id, event.facts.publicOutcome, identityById),
            ...factRows("involved", event.id, event.facts.involvedOutcome, identityById),
          ],
          sequence: event.sequence,
          summary: eventSummary(event),
          title: EVENT_TITLES[event.type],
          type: event.type,
        };
      }),
  };
}
