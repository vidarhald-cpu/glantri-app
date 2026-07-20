import { getCombatDeclarationActionLabel } from "./combatDeclarationValidation";
import type { CombatAdjustDistanceProposal } from "./combatAdjustDistance";
import type { CombatFeintProposal } from "./combatFeint";
import {
  getCombatRoundTimelineRoundStates,
  type CombatRoundState,
} from "./combatRoundManager";
import { deriveLegacyCombatStepEvents } from "./combatStepEvents";
import type { CombatStepEvent } from "./combatStepEventSchema";

export type CombatLogEventCategory =
  | "round"
  | "declaration"
  | "attempt"
  | "response"
  | "movement"
  | "contest"
  | "attack"
  | "defense"
  | "damage"
  | "condition"
  | "state_change";

export type CombatLogPhase = "declaration" | "phase1" | "phase2" | "round_end";

export interface CombatLogSubjectPresentation {
  readonly displayName: string;
  readonly participantId: string;
}

export type CombatLogSummaryFacts =
  | { readonly kind: "round_opened"; readonly roundNumber: number }
  | {
      readonly actionId?: string;
      readonly actionLabel: string;
      readonly kind: "declaration_submitted";
    }
  | {
      readonly currentDistance?: number;
      readonly direction?: "closer" | "farther" | "unchanged";
      readonly kind: "maneuver_attempt";
      readonly maneuver: "adjust_distance" | "feint";
      readonly requestedDistance?: number;
    }
  | {
      readonly kind: "participant_response";
      readonly maneuver: "adjust_distance" | "feint";
      readonly response: "allowed" | "opposed" | "resisted";
    }
  | {
      readonly contest: "adjust_distance" | "feint" | "distance_control";
      readonly kind: "contest_resolved";
      readonly outcome: "allowed" | "failed" | "lost" | "succeeded" | "won";
    }
  | {
      readonly kind: "distance_changed";
      readonly nextDistance: number;
      readonly previousDistance: number;
    }
  | {
      readonly kind: "attack_resolved";
      readonly outcome: "grazed" | "hit" | "missed";
      readonly weaponName?: string;
    }
  | {
      readonly defense: "parry";
      readonly kind: "defense_resolved";
      readonly outcome: "failed" | "succeeded";
    }
  | {
      readonly amount: number;
      readonly kind: "damage_committed";
      readonly source?: "attack" | "bleeding";
    }
  | {
      readonly conditionLabel: string;
      readonly kind: "condition_applied";
    }
  | {
      readonly kind: "review_completed";
      readonly review: "participant";
    };

export interface CombatLogEventPresentation {
  readonly actionKind?: string;
  readonly actor?: CombatLogSubjectPresentation;
  readonly attackResultId?: string;
  readonly category: CombatLogEventCategory;
  readonly detailResultId?: string;
  readonly encounterId: string;
  readonly id: string;
  readonly occurredAt?: string;
  readonly opportunityId?: string;
  readonly phase?: CombatLogPhase;
  readonly processId?: string;
  readonly proposalId?: string;
  readonly roundNumber: number;
  readonly sequence: number;
  readonly sourceEventIds: readonly string[];
  readonly sourceRevision: string;
  readonly state: "final" | "provisional";
  readonly summary: string;
  readonly summaryFacts: CombatLogSummaryFacts;
  readonly target?: CombatLogSubjectPresentation;
  readonly taskId?: string;
}

export interface CombatLogProjection {
  readonly encounterId: string;
  /** Oldest-to-newest. Consumers must opt in explicitly if they display another order. */
  readonly events: readonly CombatLogEventPresentation[];
  readonly sourceRevision: string;
}

interface Candidate extends Omit<CombatLogEventPresentation, "sequence"> {
  readonly semanticOrder: number;
  readonly sourceSequence: number;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  return value;
}

function stringFact(facts: Record<string, unknown>, key: string): string | undefined {
  const value = facts[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberFact(facts: Record<string, unknown>, key: string): number | undefined {
  const value = facts[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function booleanFact(facts: Record<string, unknown>, key: string): boolean | undefined {
  const value = facts[key];
  return typeof value === "boolean" ? value : undefined;
}

function phaseForEvent(event: CombatStepEvent): CombatLogPhase {
  if (event.type === "declaration") return "declaration";
  if (event.phase) return event.phase;
  return "round_end";
}

function actionLabel(actionId?: string): string {
  const labels: Readonly<Record<string, string>> = {
    adjust_range_attack: "Adjust Distance and Attack",
    attack_parry: "Single Attack",
    double_attack: "Double Attack",
    feint_attack: "Feint and Attack",
    parry_attack: "Reactive Attack",
  };
  return actionId ? (labels[actionId] ?? getCombatDeclarationActionLabel(actionId)) : "Open action";
}

function subject(
  participantId: string | undefined,
  labels: ReadonlyMap<string, string>,
): CombatLogSubjectPresentation | undefined {
  if (!participantId) return undefined;
  return {
    displayName: labels.get(participantId) ?? "Unknown combatant",
    participantId,
  };
}

function possessive(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}’s`;
}

function targetFromDeclaration(
  participantId: string,
  state: CombatRoundState,
): string | undefined {
  const declaration = state.participants.find((entry) => entry.participantId === participantId)
    ?.declaration;
  return (
    declaration?.phaseContexts?.phase1?.targetParticipantId ??
    declaration?.phaseContexts?.phase2?.targetParticipantId ??
    declaration?.adjustDistance?.targetParticipantId ??
    declaration?.feint?.targetParticipantId
  );
}

function semanticEventKey(event: CombatStepEvent): string {
  return [
    event.type,
    event.ownerParticipantId,
    event.attackResultId,
    event.parryResultId,
    event.damageResultId,
    event.distanceProposalId,
    event.healthRollId,
    event.phase,
  ]
    .filter(Boolean)
    .join(":");
}

function sourceEventsForRound(state: CombatRoundState, encounterId: string): CombatStepEvent[] {
  const canonicalKeys = new Set(state.events.map(semanticEventKey));
  const legacy = deriveLegacyCombatStepEvents({
    commands: state.commands,
    encounterId,
    participants: state.participants,
    phaseResolutionResults: state.phaseResolutionResults,
    roundEndReview: state.roundEndReview,
    roundNumber: state.roundNumber,
    stepSnapshots: state.stepSnapshots,
  });
  return [
    ...state.events,
    ...legacy.filter((event) => !canonicalKeys.has(semanticEventKey(event))),
  ];
}

function baseCandidate(input: {
  actor?: CombatLogSubjectPresentation;
  category: CombatLogEventCategory;
  detailResultId?: string;
  encounterId: string;
  eventId: string;
  occurredAt?: string | null;
  phase?: CombatLogPhase;
  proposalId?: string;
  roundNumber: number;
  semanticOrder?: number;
  sourceEventIds: readonly string[];
  sourceRevision: string;
  sourceSequence: number;
  state?: "final" | "provisional";
  summary: string;
  summaryFacts: CombatLogSummaryFacts;
  target?: CombatLogSubjectPresentation;
}): Candidate {
  return {
    actor: input.actor,
    category: input.category,
    detailResultId: input.detailResultId,
    encounterId: input.encounterId,
    id: `combat-log:${input.eventId}`,
    occurredAt: input.occurredAt ?? undefined,
    phase: input.phase,
    proposalId: input.proposalId,
    roundNumber: input.roundNumber,
    semanticOrder: input.semanticOrder ?? 0,
    sourceEventIds: input.sourceEventIds,
    sourceRevision: input.sourceRevision,
    sourceSequence: input.sourceSequence,
    state: input.state ?? "final",
    summary: input.summary,
    summaryFacts: input.summaryFacts,
    target: input.target,
  };
}

function projectDeclaration(input: {
  encounterId: string;
  event: CombatStepEvent;
  labels: ReadonlyMap<string, string>;
  sourceRevision: string;
  state: CombatRoundState;
}): Candidate | undefined {
  const actor = subject(input.event.actorParticipantId ?? input.event.ownerParticipantId, input.labels);
  if (!actor) return undefined;
  const actionId = stringFact(input.event.facts.involvedOutcome, "actionId");
  const label = actionLabel(actionId);
  const target = subject(targetFromDeclaration(actor.participantId, input.state), input.labels);
  const targetText = target ? ` against ${target.displayName}` : "";
  return {
    ...baseCandidate({
      actor,
      category: "declaration",
      encounterId: input.encounterId,
      eventId: `${input.event.id}:submitted`,
      occurredAt: input.event.occurredAt,
      phase: "declaration",
      roundNumber: input.event.roundNumber,
      sourceEventIds: [input.event.id],
      sourceRevision: input.sourceRevision,
      sourceSequence: input.event.sequence,
      summary: `${actor.displayName} declared ${label}${targetText}.`,
      summaryFacts: { actionId, actionLabel: label, kind: "declaration_submitted" },
      target,
    }),
    actionKind: actionId,
  };
}

function projectAttack(input: {
  encounterId: string;
  event: CombatStepEvent;
  labels: ReadonlyMap<string, string>;
  sourceRevision: string;
}): Candidate | undefined {
  const actor = subject(input.event.attackerParticipantId ?? input.event.actorParticipantId, input.labels);
  const target = subject(input.event.defenderParticipantId ?? input.event.targetParticipantId, input.labels);
  if (!actor || !target) return undefined;
  const hit = booleanFact(input.event.facts.publicOutcome, "hit");
  const grazing = booleanFact(input.event.facts.publicOutcome, "grazing");
  if (hit === undefined && grazing === undefined) return undefined;
  const outcome = grazing ? "grazed" : hit ? "hit" : "missed";
  const weaponName = stringFact(input.event.facts.involvedOutcome, "weaponName");
  const weaponText = weaponName ? ` with ${weaponName}` : "";
  const summary = `${actor.displayName} attacked ${target.displayName}${weaponText}. The attack ${outcome}.`;
  return {
    ...baseCandidate({
      actor,
      category: "attack",
      detailResultId: input.event.attackResultId,
      encounterId: input.encounterId,
      eventId: `${input.event.id}:resolved`,
      occurredAt: input.event.occurredAt,
      phase: phaseForEvent(input.event),
      roundNumber: input.event.roundNumber,
      sourceEventIds: [input.event.id],
      sourceRevision: input.sourceRevision,
      sourceSequence: input.event.sequence,
      summary,
      summaryFacts: { kind: "attack_resolved", outcome, weaponName },
      target,
    }),
    actionKind: stringFact(input.event.facts.involvedOutcome, "actionId"),
    attackResultId: input.event.attackResultId,
    opportunityId: stringFact(input.event.facts.involvedOutcome, "attackOpportunityId"),
  };
}

function projectParry(input: {
  encounterId: string;
  event: CombatStepEvent;
  labels: ReadonlyMap<string, string>;
  sourceRevision: string;
}): Candidate | undefined {
  if (input.event.status === "not_applicable") return undefined;
  const success = booleanFact(input.event.facts.publicOutcome, "success");
  if (success === undefined) return undefined;
  const actor = subject(input.event.defenderParticipantId ?? input.event.actorParticipantId, input.labels);
  const target = subject(input.event.attackerParticipantId ?? input.event.targetParticipantId, input.labels);
  if (!actor) return undefined;
  const outcome = success ? "succeeded" : "failed";
  return {
    ...baseCandidate({
      actor,
      category: "defense",
      detailResultId: input.event.parryResultId,
      encounterId: input.encounterId,
      eventId: `${input.event.id}:resolved`,
      occurredAt: input.event.occurredAt,
      phase: phaseForEvent(input.event),
      roundNumber: input.event.roundNumber,
      sourceEventIds: [input.event.id],
      sourceRevision: input.sourceRevision,
      sourceSequence: input.event.sequence,
      summary: `${possessive(actor.displayName)} parry ${outcome}.`,
      summaryFacts: { defense: "parry", kind: "defense_resolved", outcome },
      target,
    }),
    attackResultId: input.event.attackResultId,
  };
}

function projectDamage(input: {
  encounterId: string;
  event: CombatStepEvent;
  labels: ReadonlyMap<string, string>;
  sourceRevision: string;
}): Candidate | undefined {
  const amount = numberFact(input.event.facts.involvedOutcome, "finalCommittedDamage");
  const target = subject(input.event.defenderParticipantId ?? input.event.targetParticipantId, input.labels);
  if (amount === undefined || !target) return undefined;
  return {
    ...baseCandidate({
      actor: subject(input.event.attackerParticipantId ?? input.event.actorParticipantId, input.labels),
      category: "damage",
      detailResultId: input.event.damageResultId,
      encounterId: input.encounterId,
      eventId: `${input.event.id}:damage`,
      occurredAt: input.event.occurredAt,
      phase: phaseForEvent(input.event),
      roundNumber: input.event.roundNumber,
      sourceEventIds: [input.event.id],
      sourceRevision: input.sourceRevision,
      sourceSequence: input.event.sequence,
      summary: `${target.displayName} suffered ${amount} damage.`,
      summaryFacts: { amount, kind: "damage_committed", source: "attack" },
      target,
    }),
    attackResultId: input.event.attackResultId,
  };
}

function projectRoundEndReview(input: {
  encounterId: string;
  event: CombatStepEvent;
  labels: ReadonlyMap<string, string>;
  sourceRevision: string;
}): Candidate[] {
  const actor = subject(input.event.actorParticipantId ?? input.event.ownerParticipantId, input.labels);
  if (!actor) return [];
  const damage = input.event.facts.involvedOutcome.damageApplied;
  const candidates: Candidate[] = [];
  if (Array.isArray(damage)) {
    damage.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") return;
      const amount = numberFact(entry as Record<string, unknown>, "amount");
      const bleedType = stringFact(entry as Record<string, unknown>, "bleedType");
      if (amount === undefined) return;
      candidates.push(
        baseCandidate({
          category: "damage",
          encounterId: input.encounterId,
          eventId: `${input.event.id}:bleeding:${index}`,
          occurredAt: input.event.occurredAt,
          phase: "round_end",
          roundNumber: input.event.roundNumber,
          semanticOrder: index,
          sourceEventIds: [input.event.id],
          sourceRevision: input.sourceRevision,
          sourceSequence: input.event.sequence,
          summary: `${actor.displayName} suffered ${amount} damage from ${bleedType === "internal" ? "internal " : ""}bleeding.`,
          summaryFacts: { amount, kind: "damage_committed", source: "bleeding" },
          target: actor,
        }),
      );
    });
  }
  candidates.push(
    baseCandidate({
      actor,
      category: "state_change",
      encounterId: input.encounterId,
      eventId: `${input.event.id}:review`,
      occurredAt: input.event.occurredAt,
      phase: "round_end",
      roundNumber: input.event.roundNumber,
      semanticOrder: candidates.length + 1,
      sourceEventIds: [input.event.id],
      sourceRevision: input.sourceRevision,
      sourceSequence: input.event.sequence,
      summary: `${actor.displayName} completed round-end review.`,
      summaryFacts: { kind: "review_completed", review: "participant" },
    }),
  );
  return candidates;
}

function projectFeint(input: {
  encounterId: string;
  event: CombatStepEvent;
  labels: ReadonlyMap<string, string>;
  proposal?: CombatFeintProposal;
  sourceRevision: string;
}): Candidate[] {
  const proposal = input.proposal;
  if (!proposal) return [];
  const actor = subject(proposal.attackerParticipantId, input.labels);
  const target = subject(proposal.defenderParticipantId, input.labels);
  if (!actor || !target) return [];
  const common = {
    actor,
    encounterId: input.encounterId,
    occurredAt: input.event.occurredAt,
    phase: "phase1" as const,
    proposalId: proposal.id,
    roundNumber: input.event.roundNumber,
    sourceEventIds: [input.event.id],
    sourceRevision: input.sourceRevision,
    sourceSequence: input.event.sequence,
    target,
  };
  if (input.event.type === "feint_roll") {
    const side = stringFact(input.event.facts.involvedOutcome, "side");
    if (side !== "defender") return [];
    return [
      baseCandidate({
        ...common,
        category: "response",
        detailResultId: proposal.id,
        eventId: `${input.event.id}:response`,
        summary: `${target.displayName} attempted to resist ${possessive(actor.displayName)} feint.`,
        summaryFacts: { kind: "participant_response", maneuver: "feint", response: "resisted" },
      }),
    ];
  }
  if (input.event.type !== "feint_committed") return [];
  const succeeded = (proposal.difference ?? 0) > 0;
  return [
    baseCandidate({
      ...common,
      category: "contest",
      detailResultId: proposal.id,
      eventId: `${input.event.id}:resolved`,
      summary: `${possessive(actor.displayName)} feint ${succeeded ? "succeeded" : "failed"}.`,
      summaryFacts: {
        contest: "feint",
        kind: "contest_resolved",
        outcome: succeeded ? "succeeded" : "failed",
      },
    }),
  ];
}

function projectAdjustDistance(input: {
  encounterId: string;
  event: CombatStepEvent;
  labels: ReadonlyMap<string, string>;
  proposal?: CombatAdjustDistanceProposal;
  sourceRevision: string;
}): Candidate[] {
  const proposal = input.proposal;
  if (!proposal) return [];
  const actor = subject(proposal.attackerParticipantId, input.labels);
  const target = subject(proposal.defenderParticipantId, input.labels);
  if (!actor || !target) return [];
  const common = {
    actor,
    encounterId: input.encounterId,
    occurredAt: input.event.occurredAt,
    phase: "phase1" as const,
    proposalId: proposal.id,
    roundNumber: input.event.roundNumber,
    sourceEventIds: [input.event.id],
    sourceRevision: input.sourceRevision,
    sourceSequence: input.event.sequence,
    target,
  };
  if (input.event.type === "adjust_distance_response") {
    const response = proposal.defenderResponse === "allow" ? "allowed" : "opposed";
    return [
      baseCandidate({
        ...common,
        actor: target,
        category: "response",
        detailResultId: proposal.id,
        eventId: `${input.event.id}:response`,
        summary:
          response === "allowed"
            ? `${target.displayName} allowed the movement.`
            : `${target.displayName} opposed the movement.`,
        summaryFacts: { kind: "participant_response", maneuver: "adjust_distance", response },
        target: actor,
      }),
    ];
  }
  if (input.event.type !== "adjust_distance_committed") return [];
  const outcome = proposal.review?.acceptedOutcome;
  const result: Candidate[] = [];
  if (proposal.defenderResponse === "oppose") {
    const won = outcome === "successful";
    result.push(
      baseCandidate({
        ...common,
        category: "contest",
        detailResultId: proposal.id,
        eventId: `${input.event.id}:contest`,
        summary: `${actor.displayName} ${won ? "won" : "lost"} the distance contest.`,
        summaryFacts: {
          contest: "adjust_distance",
          kind: "contest_resolved",
          outcome: won ? "won" : "lost",
        },
      }),
    );
  }
  const nextDistance = numberFact(input.event.facts.involvedOutcome, "committedDistance");
  const previousDistance = numberFact(input.event.facts.involvedOutcome, "previousDistance");
  if (nextDistance !== undefined && previousDistance !== undefined && nextDistance !== previousDistance) {
    result.push(
      baseCandidate({
        ...common,
        category: "movement",
        detailResultId: proposal.id,
        eventId: `${input.event.id}:distance`,
        semanticOrder: 1,
        summary: `Distance between ${actor.displayName} and ${target.displayName} changed from ${previousDistance} to ${nextDistance}.`,
        summaryFacts: { kind: "distance_changed", nextDistance, previousDistance },
      }),
    );
  }
  return result;
}

function projectDistanceApplied(input: {
  encounterId: string;
  event: CombatStepEvent;
  labels: ReadonlyMap<string, string>;
  sourceRevision: string;
}): Candidate | undefined {
  const participantIds = input.event.visibility.involvedParticipantIds;
  const actor = subject(participantIds[0], input.labels);
  const target = subject(participantIds[1], input.labels);
  const previousDistance = numberFact(input.event.facts.involvedOutcome, "previousDistance");
  const nextDistance = numberFact(input.event.facts.involvedOutcome, "appliedDistance");
  if (!actor || !target || previousDistance === undefined || nextDistance === undefined) return undefined;
  return baseCandidate({
    actor,
    category: "movement",
    detailResultId: input.event.distanceProposalId,
    encounterId: input.encounterId,
    eventId: `${input.event.id}:distance`,
    occurredAt: input.event.occurredAt,
    phase: "round_end",
    proposalId: input.event.distanceProposalId,
    roundNumber: input.event.roundNumber,
    sourceEventIds: [input.event.id],
    sourceRevision: input.sourceRevision,
    sourceSequence: input.event.sequence,
    summary: `Distance between ${actor.displayName} and ${target.displayName} changed from ${previousDistance} to ${nextDistance}.`,
    summaryFacts: { kind: "distance_changed", nextDistance, previousDistance },
    target,
  });
}

function maneuverAttempts(input: {
  encounterId: string;
  events: readonly CombatStepEvent[];
  labels: ReadonlyMap<string, string>;
  sourceRevision: string;
  state: CombatRoundState;
}): Candidate[] {
  const attempts: Candidate[] = [];
  for (const proposal of input.state.adjustDistanceProposals) {
    if (proposal.status === "awaiting_action_turn") continue;
    const actor = subject(proposal.attackerParticipantId, input.labels);
    const target = subject(proposal.defenderParticipantId, input.labels);
    if (!actor || !target) continue;
    const sourceEvent = input.events.find(
      (event) => stringFact(event.facts.involvedOutcome, "proposalId") === proposal.id,
    );
    const direction = proposal.direction === "closer" ? "move closer to" : proposal.direction === "farther" ? "move farther from" : "maintain distance from";
    attempts.push(
      baseCandidate({
        actor,
        category: "attempt",
        detailResultId: proposal.id,
        encounterId: input.encounterId,
        eventId: `${proposal.id}:attempt`,
        occurredAt: sourceEvent?.occurredAt ?? proposal.attackerRoll?.rolledAt,
        phase: "phase1",
        proposalId: proposal.id,
        roundNumber: proposal.roundNumber,
        semanticOrder: -1,
        sourceEventIds: sourceEvent ? [proposal.id, sourceEvent.id] : [proposal.id],
        sourceRevision: input.sourceRevision,
        sourceSequence: sourceEvent?.sequence ?? Number.MAX_SAFE_INTEGER,
        summary: `${actor.displayName} attempted to ${direction} ${target.displayName}.`,
        summaryFacts: {
          currentDistance: proposal.currentDistance,
          direction: proposal.direction,
          kind: "maneuver_attempt",
          maneuver: "adjust_distance",
          requestedDistance: proposal.requestedDistance,
        },
        target,
      }),
    );
  }
  for (const proposal of input.state.feintProposals) {
    if (proposal.status === "awaiting_action_turn") continue;
    const actor = subject(proposal.attackerParticipantId, input.labels);
    const target = subject(proposal.defenderParticipantId, input.labels);
    if (!actor || !target) continue;
    const sourceEvent = input.events.find(
      (event) => stringFact(event.facts.involvedOutcome, "proposalId") === proposal.id,
    );
    attempts.push(
      baseCandidate({
        actor,
        category: "attempt",
        detailResultId: proposal.id,
        encounterId: input.encounterId,
        eventId: `${proposal.id}:attempt`,
        occurredAt: sourceEvent?.occurredAt ?? proposal.attackerRoll?.rolledAt,
        phase: "phase1",
        proposalId: proposal.id,
        roundNumber: proposal.roundNumber,
        semanticOrder: -1,
        sourceEventIds: sourceEvent ? [proposal.id, sourceEvent.id] : [proposal.id],
        sourceRevision: input.sourceRevision,
        sourceSequence: sourceEvent?.sequence ?? Number.MAX_SAFE_INTEGER,
        summary: `${actor.displayName} attempted to feint ${target.displayName}.`,
        summaryFacts: { kind: "maneuver_attempt", maneuver: "feint" },
        target,
      }),
    );
  }
  return attempts;
}

function compareCandidates(left: Candidate, right: Candidate): number {
  if (left.roundNumber !== right.roundNumber) return left.roundNumber - right.roundNumber;
  if (left.category === "round" && right.category !== "round") return -1;
  if (right.category === "round" && left.category !== "round") return 1;
  if (left.occurredAt && right.occurredAt && left.occurredAt !== right.occurredAt) {
    return left.occurredAt.localeCompare(right.occurredAt);
  }
  return (
    left.sourceSequence - right.sourceSequence ||
    left.semanticOrder - right.semanticOrder ||
    left.id.localeCompare(right.id)
  );
}

export function buildCombatLogProjection(input: {
  encounterId: string;
  sourceRevision: string;
  state: CombatRoundState;
}): CombatLogProjection {
  const candidates: Candidate[] = [];
  for (const roundState of getCombatRoundTimelineRoundStates(input.state)) {
    const labels = new Map(
      roundState.participants.map((participant) => [participant.participantId, participant.label]),
    );
    const roundEvents = sourceEventsForRound(roundState, input.encounterId);
    candidates.push(
      baseCandidate({
        category: "round",
        encounterId: input.encounterId,
        eventId: `${input.encounterId}:round:${roundState.roundNumber}:opened`,
        phase: "declaration",
        roundNumber: roundState.roundNumber,
        sourceEventIds: [],
        sourceRevision: input.sourceRevision,
        sourceSequence: -2,
        summary: `Round ${roundState.roundNumber} began.`,
        summaryFacts: { kind: "round_opened", roundNumber: roundState.roundNumber },
      }),
      ...maneuverAttempts({
        encounterId: input.encounterId,
        events: roundEvents,
        labels,
        sourceRevision: input.sourceRevision,
        state: roundState,
      }),
    );
    const feints = new Map(roundState.feintProposals.map((proposal) => [proposal.id, proposal]));
    const adjustments = new Map(
      roundState.adjustDistanceProposals.map((proposal) => [proposal.id, proposal]),
    );
    for (const event of roundEvents) {
      if (event.type === "declaration") {
        const declaration = projectDeclaration({
          encounterId: input.encounterId,
          event,
          labels,
          sourceRevision: input.sourceRevision,
          state: roundState,
        });
        if (declaration) candidates.push(declaration);
      } else if (event.type === "attack") {
        const attack = projectAttack({
          encounterId: input.encounterId,
          event,
          labels,
          sourceRevision: input.sourceRevision,
        });
        if (attack) candidates.push(attack);
      } else if (event.type === "parry") {
        const parry = projectParry({
          encounterId: input.encounterId,
          event,
          labels,
          sourceRevision: input.sourceRevision,
        });
        if (parry) candidates.push(parry);
      } else if (event.type === "damage_committed") {
        const damage = projectDamage({
          encounterId: input.encounterId,
          event,
          labels,
          sourceRevision: input.sourceRevision,
        });
        if (damage) candidates.push(damage);
      } else if (event.type === "participant_su_review") {
        candidates.push(
          ...projectRoundEndReview({
            encounterId: input.encounterId,
            event,
            labels,
            sourceRevision: input.sourceRevision,
          }),
        );
      } else if (event.type.startsWith("feint_")) {
        candidates.push(
          ...projectFeint({
            encounterId: input.encounterId,
            event,
            labels,
            proposal: feints.get(stringFact(event.facts.involvedOutcome, "proposalId") ?? ""),
            sourceRevision: input.sourceRevision,
          }),
        );
      } else if (event.type.startsWith("adjust_distance_")) {
        candidates.push(
          ...projectAdjustDistance({
            encounterId: input.encounterId,
            event,
            labels,
            proposal: adjustments.get(stringFact(event.facts.involvedOutcome, "proposalId") ?? ""),
            sourceRevision: input.sourceRevision,
          }),
        );
      } else if (event.type === "distance_control_applied") {
        const distance = projectDistanceApplied({
          encounterId: input.encounterId,
          event,
          labels,
          sourceRevision: input.sourceRevision,
        });
        if (distance) candidates.push(distance);
      }
    }
  }

  const uniqueCandidates = [...new Map(candidates.map((candidate) => [candidate.id, candidate])).values()];
  const events = uniqueCandidates.sort(compareCandidates).map(({ semanticOrder: _, sourceSequence: __, ...event }, sequence) => ({
    ...event,
    sequence,
  }));
  return deepFreeze({ encounterId: input.encounterId, events, sourceRevision: input.sourceRevision });
}
