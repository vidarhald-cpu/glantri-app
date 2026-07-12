import {
  combatStepEventSchema,
  type CombatStepEvent,
  type CombatStepEventFacts,
  type CombatStepEventHiddenIdentityFallback,
  type CombatStepEventIdentityRef,
  type CombatStepEventIdentityRole,
  type CombatStepEventOutcomeScope,
  type CombatStepEventType,
} from "./combatStepEventSchema";
import type {
  CombatRoundCommand,
  CombatRoundPhase,
  CombatRoundStep,
} from "./combatRoundManager";

export type CanonicalCombatStepEventDraft = Omit<
  CombatStepEvent,
  | "commandId"
  | "combatEffectIds"
  | "completeness"
  | "encounterId"
  | "facts"
  | "id"
  | "missingFacts"
  | "occurredAt"
  | "roundNumber"
  | "schemaVersion"
  | "sequence"
  | "source"
  | "visibility"
> & {
  facts?: Partial<CombatStepEventFacts>;
  combatEffectIds?: string[];
  involvedParticipantIds?: string[];
  outcomeScope?: CombatStepEventOutcomeScope;
  sourceToken?: string;
  sourceIds?: string[];
};

function unique(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function identityRefs(input: CanonicalCombatStepEventDraft): CombatStepEventIdentityRef[] {
  const refs: CombatStepEventIdentityRef[] = [];
  const add = (
    participantId: string | undefined,
    role: CombatStepEventIdentityRole,
    hiddenIdentityFallback: CombatStepEventHiddenIdentityFallback,
  ) => {
    if (participantId && !refs.some((ref) => ref.participantId === participantId && ref.role === role)) {
      refs.push({ hiddenIdentityFallback, participantId, role });
    }
  };

  add(input.actorParticipantId, "actor", "omit");
  add(input.targetParticipantId, "target", "unseen_target");
  add(input.attackerParticipantId, "attacker", "unseen_attacker");
  add(input.defenderParticipantId, "defender", "unseen_target");
  add(input.rollerParticipantId, "roller", "omit");
  return refs;
}

export function buildCanonicalCombatStepEventId(input: {
  commandId: string;
  sourceToken?: string;
  type: CombatStepEventType;
}): string {
  return ["combat-step-event", input.commandId, input.type, input.sourceToken]
    .filter(Boolean)
    .join(":");
}

export function appendCanonicalCombatStepEventForCommand(input: {
  command: CombatRoundCommand;
  draft: CanonicalCombatStepEventDraft;
  encounterId: string;
  events: readonly CombatStepEvent[];
}): CombatStepEvent[] {
  const id = buildCanonicalCombatStepEventId({
    commandId: input.command.id,
    sourceToken: input.draft.sourceToken,
    type: input.draft.type,
  });

  if (
    input.events.some(
      (event) =>
        event.id === id ||
        (event.commandId === input.command.id &&
          event.type === input.draft.type &&
          (!input.draft.sourceToken || event.source.sourceIds.includes(input.draft.sourceToken))),
    )
  ) {
    return [...input.events];
  }

  const sequence = input.events.reduce(
    (highest, event) => Math.max(highest, event.sequence),
    -1,
  ) + 1;
  const involvedParticipantIds = unique(
    input.draft.involvedParticipantIds ?? [
      input.draft.actorParticipantId,
      input.draft.targetParticipantId,
      input.draft.attackerParticipantId,
      input.draft.defenderParticipantId,
    ],
  );
  const event = combatStepEventSchema.parse({
    ...input.draft,
    commandId: input.command.id,
    completeness: "complete",
    encounterId: input.encounterId,
    facts: {
      gmReview: input.draft.facts?.gmReview ?? {},
      involvedOutcome: input.draft.facts?.involvedOutcome ?? {},
      publicOutcome: input.draft.facts?.publicOutcome ?? {},
      rollerPrivate: input.draft.facts?.rollerPrivate ?? {},
    },
    id,
    missingFacts: [],
    occurredAt: input.command.createdAt,
    roundNumber: input.command.roundNumber,
    schemaVersion: 1,
    sequence,
    source: {
      commandType: input.command.type,
      kind: "canonical",
      sourceIds: unique([
        input.command.id,
        input.draft.sourceToken,
        ...(input.draft.sourceIds ?? []),
      ]),
    },
    visibility: {
      identityRefs: identityRefs(input.draft),
      involvedParticipantIds,
      outcomeScope: input.draft.outcomeScope ?? "involved",
      rollerParticipantId: input.draft.rollerParticipantId,
    },
  });

  return [...input.events, event];
}

export function removeCanonicalCombatStepEventsForCommand(input: {
  commandId: string;
  events: readonly CombatStepEvent[];
}): CombatStepEvent[] {
  return input.events.filter((event) => event.commandId !== input.commandId);
}

export function getCombatStepEventPhaseStep(input: {
  kind: "initiative" | "attack" | "parry" | "damage";
  phase: CombatRoundPhase;
}): CombatRoundStep {
  if (input.kind === "initiative") {
    return input.phase === "phase1" ? "initiative_phase_1" : "initiative_phase_2";
  }
  if (input.kind === "attack") {
    return input.phase === "phase1" ? "phase_1_actions" : "phase_2_actions";
  }
  if (input.kind === "parry") {
    return input.phase === "phase1" ? "review_phase_2_actions" : "review_phase_2_damage";
  }
  return input.phase === "phase1" ? "phase_1_damage" : "phase_2_damage";
}
