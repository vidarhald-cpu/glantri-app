import type { CombatLogEventPresentation, ProjectedCombatHistoryEvent } from "@glantri/domain";

/**
 * Forgejo #836: a compact, actor-qualified one-line "Last action" for the GM.
 *
 * The line is a property of the encounter (the most recent action anywhere), never of the
 * participant being inspected. Every candidate must resolve a named actor; an event whose actor
 * cannot be named is skipped rather than rendered without one, because omitting the actor is the
 * defect this line exists to fix.
 */
export interface CombatLastAction {
  readonly actorLabel: string;
  readonly sourceEventId?: string;
  readonly text: string;
}

/** The recorded result of a committed initiative (`state.committedInitiativeOrders`). */
export interface CombatLastActionInitiativeCommit {
  readonly entries: readonly {
    readonly initiativeResult?: { readonly total: number };
    readonly participantId: string;
  }[];
  readonly phase: string;
  readonly roundNumber: number;
}

export interface BuildCombatLastActionInput {
  readonly committedInitiativeOrders?: readonly CombatLastActionInitiativeCommit[];
  readonly gmEvents: readonly ProjectedCombatHistoryEvent[];
  readonly logEvents: readonly CombatLogEventPresentation[];
  readonly participants: readonly { readonly label: string; readonly participantId: string }[];
  readonly roundNumber: number;
}

interface Candidate {
  readonly order: number;
  readonly result: CombatLastAction;
}

/** Order of the round's phases; a phase's initiative follows every strictly earlier phase. */
const PHASE_RANK: Readonly<Record<string, number>> = {
  declaration: 0,
  phase1: 1,
  phase2: 2,
  round_end: 3,
};

/** A long order would stop being one short line. */
const ORDER_NAMES_SHOWN = 4;

function attackOutcomeWord(outcome: "grazed" | "hit" | "missed"): string {
  return outcome === "missed" ? "miss" : outcome === "grazed" ? "graze" : "hit";
}

function logEventText(event: CombatLogEventPresentation, actorLabel: string): string | undefined {
  const facts = event.summaryFacts;
  switch (facts.kind) {
    case "declaration_submitted":
      return `${actorLabel} declared ${facts.actionLabel}`;
    case "attack_resolved":
      return event.target
        ? `${actorLabel} attacked ${event.target.displayName} — ${attackOutcomeWord(facts.outcome)}`
        : undefined;
    case "defense_resolved":
      return `${actorLabel} parried${
        event.target ? ` ${event.target.displayName}` : ""
      } — ${facts.outcome}`;
    case "damage_committed":
      // A bleeding tick's actor is the bleeder, not someone who acted; only attack damage counts.
      return facts.source === "attack" && event.target
        ? `${actorLabel} dealt ${facts.amount} damage to ${event.target.displayName}`
        : undefined;
    case "maneuver_attempt":
    case "participant_response":
    case "contest_resolved": {
      const summary = event.summary.replace(/\.$/, "");
      return summary.startsWith(actorLabel) ? summary : undefined;
    }
    default:
      return undefined;
  }
}

export function buildCombatLastAction(input: BuildCombatLastActionInput): CombatLastAction | null {
  const labels = new Map(input.participants.map((entry) => [entry.participantId, entry.label]));
  // The Combat Log is already oldest-to-newest, so its own position is the order key. Many log
  // entries are derived from legacy commands: they have no raw source event and may carry no
  // timestamp, so neither source sequences nor times can order them reliably. Raw events the log
  // does not project (an individual initiative roll) are placed by the round's own structure
  // instead: a phase's initiative is rolled after every earlier phase's entries and before any of
  // that phase's own entries. Placing it by sequence alone ranked a roll above every later entry.
  const candidates: Candidate[] = [];
  const logPositions: Array<{ order: number; phase?: string }> = [];

  for (const [index, event] of input.logEvents.entries()) {
    if (event.roundNumber !== input.roundNumber || event.state !== "final") continue;
    logPositions.push({ order: index, phase: event.phase });
    const actorLabel = event.actor?.displayName;
    if (!actorLabel) continue;
    const text = logEventText(event, actorLabel);
    if (!text) continue;
    candidates.push({ order: index, result: { actorLabel, sourceEventId: event.id, text } });
  }

  for (const event of input.gmEvents) {
    if (event.type !== "initiative" || event.roundNumber !== input.roundNumber) continue;
    const actorLabel = event.ownerParticipantId ? labels.get(event.ownerParticipantId) : undefined;
    const total = event.facts.publicOutcome?.total;
    if (!actorLabel || typeof total !== "number") continue;
    const rank = event.phase ? PHASE_RANK[event.phase] : undefined;
    const precedingLog = logPositions
      .filter(
        (entry) =>
          rank !== undefined &&
          entry.phase !== undefined &&
          (PHASE_RANK[entry.phase] ?? Number.POSITIVE_INFINITY) < rank,
      )
      .reduce((max, entry) => Math.max(max, entry.order), -1);
    candidates.push({
      order: precedingLog + 0.5,
      result: {
        actorLabel,
        sourceEventId: event.id,
        text: `${actorLabel} rolled Initiative ${total}`,
      },
    });
  }

  // A bulk initiative commit (the GM commits initiative for every combatant at once) records an
  // order, not a roller, so the line names the GM as the source and never a combatant. When the
  // phase's initiative was rolled individually, the commit only closes those rolls and the last
  // roller stays the line.
  for (const commit of input.committedInitiativeOrders ?? []) {
    if (commit.roundNumber !== input.roundNumber) continue;
    const individuallyRolled = input.gmEvents.some(
      (event) =>
        event.type === "initiative" &&
        event.roundNumber === input.roundNumber &&
        event.phase === commit.phase,
    );
    if (individuallyRolled) continue;
    const rank = PHASE_RANK[commit.phase];
    const precedingLog = logPositions
      .filter(
        (entry) =>
          rank !== undefined &&
          entry.phase !== undefined &&
          (PHASE_RANK[entry.phase] ?? Number.POSITIVE_INFINITY) < rank,
      )
      .reduce((max, entry) => Math.max(max, entry.order), -1);
    const ranked = commit.entries.flatMap((entry) => {
      const label = labels.get(entry.participantId);
      return label && entry.initiativeResult ? [`${label} ${entry.initiativeResult.total}`] : [];
    });
    const shown = ranked.slice(0, ORDER_NAMES_SHOWN);
    const order = shown.length
      ? ` (${shown.join(", ")}${ranked.length > shown.length ? ", …" : ""})`
      : "";
    candidates.push({
      order: precedingLog + 0.5,
      result: {
        actorLabel: "GM",
        text: `GM committed initiative for all combatants${order}`,
      },
    });
  }

  let latest: Candidate | undefined;
  for (const candidate of candidates) {
    if (!latest || candidate.order >= latest.order) latest = candidate;
  }
  return latest?.result ?? null;
}
