import type { CombatLogEventPresentation } from "@glantri/domain";

/**
 * Forgejo #836: a compact, actor-qualified one-line "Last action" for the GM.
 *
 * The line is a property of the encounter (the most recent action anywhere), never of the
 * participant being inspected. Every candidate must resolve a named actor; an event whose actor
 * cannot be named is skipped rather than rendered without one, because omitting the actor is the
 * defect this line exists to fix.
 *
 * Order comes from the round's own command journal (`state.commands`), never from Combat Log
 * position, timestamps or phase tags. Every GM or player action is recorded by appending one
 * command, every event it produces carries that command's id, and a take-back removes its
 * command. So the newest command that yields a nameable action is the last action. The Combat Log
 * re-orders its entries when a modifier review re-projects the round's declarations (#836 QA
 * 24157); the journal does not, so a re-projected entry, or anything else that is not a new
 * command, cannot change which action the line shows. The Combat Log supplies only the wording
 * of the action a command produced, matched through that command's own events.
 */
export interface CombatLastAction {
  readonly actorLabel: string;
  readonly sourceEventId?: string;
  readonly text: string;
}

/** One entry of the round's command journal (`CombatRoundState["commands"]`). */
export interface CombatLastActionCommand {
  readonly id: string;
  readonly participantId: string;
  readonly phase?: string;
  readonly roundNumber: number;
  readonly type: string;
}

/** A recorded combat step event of the round (canonical, or derived from a legacy command). */
export interface CombatLastActionEvent {
  readonly commandId?: string;
  readonly facts: { readonly publicOutcome?: Readonly<Record<string, unknown>> };
  readonly id: string;
  readonly ownerParticipantId?: string;
  readonly roundNumber: number;
  readonly sequence: number;
  readonly type: string;
}

export interface BuildCombatLastActionInput {
  readonly commands: readonly CombatLastActionCommand[];
  readonly events: readonly CombatLastActionEvent[];
  readonly logEvents: readonly CombatLogEventPresentation[];
  readonly participants: readonly { readonly label: string; readonly participantId: string }[];
  readonly roundNumber: number;
}

const BULK_INITIATIVE_COMMIT = "commit_phase_initiative_resolution";

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

  // The wording of each event the Combat Log projects, by source event id.
  const wordingByEventId = new Map<string, CombatLastAction>();
  for (const event of input.logEvents) {
    if (event.roundNumber !== input.roundNumber || event.state !== "final") continue;
    const actorLabel = event.actor?.displayName;
    if (!actorLabel) continue;
    const text = logEventText(event, actorLabel);
    if (!text) continue;
    for (const sourceEventId of event.sourceEventIds) {
      wordingByEventId.set(sourceEventId, { actorLabel, sourceEventId: event.id, text });
    }
  }

  const eventsByCommandId = new Map<string, CombatLastActionEvent[]>();
  for (const event of input.events) {
    if (event.roundNumber !== input.roundNumber || !event.commandId) continue;
    const events = eventsByCommandId.get(event.commandId) ?? [];
    events.push(event);
    eventsByCommandId.set(event.commandId, events);
  }

  const commands = input.commands.filter((command) => command.roundNumber === input.roundNumber);

  for (let index = commands.length - 1; index >= 0; index -= 1) {
    const command = commands[index]!;

    // A bulk initiative commit records an order, not an action anyone took (the players roll
    // initiative), so it is skipped like any wording-less command: the previous real action stays.
    if (command.type === BULK_INITIATIVE_COMMIT) continue;

    const events = [...(eventsByCommandId.get(command.id) ?? [])].sort(
      (left, right) => right.sequence - left.sequence,
    );
    for (const event of events) {
      if (event.type === "initiative") {
        const actorLabel = labels.get(event.ownerParticipantId ?? command.participantId);
        const total = event.facts.publicOutcome?.total;
        if (actorLabel && typeof total === "number") {
          return {
            actorLabel,
            sourceEventId: event.id,
            text: `${actorLabel} rolled Initiative ${total}`,
          };
        }
        continue;
      }
      const wording = wordingByEventId.get(event.id);
      if (wording) return wording;
    }
  }
  return null;
}
