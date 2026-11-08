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

export interface BuildCombatLastActionInput {
  readonly gmEvents: readonly ProjectedCombatHistoryEvent[];
  readonly logEvents: readonly CombatLogEventPresentation[];
  readonly participants: readonly { readonly label: string; readonly participantId: string }[];
  readonly roundNumber: number;
}

interface Candidate {
  readonly order: number;
  readonly result: CombatLastAction;
}

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
  const sequenceByEventId = new Map(input.gmEvents.map((event) => [event.id, event.sequence]));
  // The Combat Log is already oldest-to-newest, so its own position is the order key. Raw events
  // that the log does not project (an initiative roll) are placed by comparing source sequences
  // against the log events that do resolve one, never by mixing the two scales.
  const candidates: Candidate[] = [];
  const logSequences: Array<{ order: number; sequence: number }> = [];

  for (const [index, event] of input.logEvents.entries()) {
    if (event.roundNumber !== input.roundNumber || event.state !== "final") continue;
    const sourceSequences = event.sourceEventIds
      .map((id) => sequenceByEventId.get(id))
      .filter((sequence): sequence is number => sequence !== undefined);
    if (sourceSequences.length) {
      logSequences.push({ order: index, sequence: Math.max(...sourceSequences) });
    }
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
    const precedingLog = logSequences
      .filter((entry) => entry.sequence < event.sequence)
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

  let latest: Candidate | undefined;
  for (const candidate of candidates) {
    if (!latest || candidate.order >= latest.order) latest = candidate;
  }
  return latest?.result ?? null;
}
