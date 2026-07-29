import type {
  CombatResultEnvelope,
  CombatLogEventPresentation,
  CombatLogProjection,
  CombatProgressionBoundaryKind,
  ProjectedCombatHistoryEvent,
} from "@glantri/domain";

import type { CombatPresentationSubject } from "./currentActionPresentation";
import { buildCombatCalculationPresentations } from "./buildCombatCalculationPresentations";
import { buildCombatEventResultModel } from "./buildCombatEventResultModel";
import type { CombatCalculationPresentation } from "./combatCalculationPresentation";
import {
  buildCombatResultGroups,
  type CombatResultGroupPresentation,
  type CombatResultLedgerFragmentInput,
} from "./combatResultLedgerPresentation";
import { formatObservationContestDifference } from "./formatObservationContestDifference";

export type CombatStepResultEntryCategory =
  | "declaration"
  | "maneuver"
  | "contest"
  | "attack"
  | "defense"
  | "distance"
  | "critical"
  | "damage"
  | "condition"
  | "review";

export interface CombatStepResultEntryPresentation {
  readonly actor?: CombatPresentationSubject;
  readonly attackResultId?: string;
  readonly calculations: readonly CombatCalculationPresentation[];
  readonly category: CombatStepResultEntryCategory;
  readonly heading: string;
  readonly id: string;
  readonly opportunityId?: string;
  readonly outcome?: string;
  readonly processId?: string;
  readonly proposalId?: string;
  readonly resultEnvelopes?: readonly CombatResultEnvelope[];
  readonly sourceEventIds: readonly string[];
  readonly state: "pending" | "final";
  readonly summary: string;
  readonly target?: CombatPresentationSubject;
}

export interface CombatStepResultPresentation {
  readonly boundary: CombatProgressionBoundaryKind;
  readonly emptyState: string;
  readonly encounterId: string;
  readonly encounterRevision: string;
  readonly entries: readonly CombatStepResultEntryPresentation[];
  /** Atomic top-level result ledger entries over the compatibility `entries` fragments. */
  readonly groups?: readonly CombatResultGroupPresentation[];
  readonly participantId: string;
  readonly phase?: "phase1" | "phase2" | "round_end";
  readonly roundNumber: number;
}

export interface BuildCombatStepResultPresentationInput {
  readonly boundary: CombatProgressionBoundaryKind;
  readonly combatLog: CombatLogProjection;
  readonly encounterId: string;
  readonly encounterRevision: string;
  readonly events: readonly ProjectedCombatHistoryEvent[];
  readonly participantId: string;
  readonly roundNumber: number;
  readonly viewer: { readonly kind: "gm" | "player" };
}

const EMPTY_STATE = "No results recorded for this character in the current step.";

function subject(
  value: CombatLogEventPresentation["actor"] | CombatLogEventPresentation["target"],
): CombatPresentationSubject | undefined {
  return value
    ? {
        hidden: !value.participantId,
        id: value.participantId,
        label: value.displayName,
      }
    : undefined;
}

function phaseForBoundary(
  boundary: CombatProgressionBoundaryKind,
): CombatStepResultPresentation["phase"] {
  if (boundary.startsWith("phase1_")) return "phase1";
  if (boundary.startsWith("phase2_")) return "phase2";
  if (boundary === "round_end" || boundary === "round_boundary") return "round_end";
  return undefined;
}

function eventBelongsToBoundary(
  event: CombatLogEventPresentation,
  boundary: CombatProgressionBoundaryKind,
): boolean {
  if (event.category === "round") return false;
  // Declaration details are published through the Combat Log after DE closes. The live result
  // panel is reserved for declaration prerequisites such as Combat Experience while DE is open.
  if (boundary === "declaration") return false;
  if (boundary === "phase1_resolution") return event.phase === "phase1";
  if (boundary === "phase2_resolution") return event.phase === "phase2";
  if (boundary === "round_end" || boundary === "round_boundary") {
    return event.phase === "round_end";
  }
  return false;
}

function eventInvolvesParticipant(input: {
  event: CombatLogEventPresentation;
  participantId: string;
  sourceEvents: readonly ProjectedCombatHistoryEvent[];
}): boolean {
  if (
    input.event.actor?.participantId === input.participantId ||
    input.event.target?.participantId === input.participantId
  ) {
    return true;
  }
  return input.sourceEvents.some(
    (event) =>
      event.ownerParticipantId === input.participantId ||
      event.identities.some((identity) => identity.participantId === input.participantId),
  );
}

function fact(event: ProjectedCombatHistoryEvent, key: string): unknown {
  return event.facts.involvedOutcome?.[key] ?? event.facts.publicOutcome[key];
}

function proposalId(event: ProjectedCombatHistoryEvent): string | undefined {
  const value = fact(event, "proposalId");
  return typeof value === "string" ? value : undefined;
}

function categoryForLogEvent(
  event: CombatLogEventPresentation,
): CombatStepResultEntryCategory | undefined {
  switch (event.category) {
    case "declaration":
      return "declaration";
    case "attempt":
    case "response":
      return "maneuver";
    case "movement":
      return "distance";
    case "contest":
      return "contest";
    case "attack":
      return "attack";
    case "defense":
      return "defense";
    case "damage":
      return "damage";
    case "condition":
      return "condition";
    case "state_change":
      return "review";
    case "round":
      return undefined;
  }
}

function headingForLogEvent(event: CombatLogEventPresentation): string {
  switch (event.summaryFacts.kind) {
    case "declaration_submitted":
      return "Declaration";
    case "maneuver_attempt":
      return event.summaryFacts.maneuver === "feint" ? "Feint" : "Adjust Distance";
    case "participant_response":
      return "Response";
    case "contest_resolved":
      return "Contest result";
    case "distance_changed":
      return "Distance";
    case "attack_resolved":
      return "Attack";
    case "defense_resolved":
      return event.summaryFacts.parryPurpose === "offensive_parry" ? "Offensive Parry" : "Defense";
    case "damage_committed":
      return "Damage";
    case "condition_applied":
      return "Condition";
    case "review_completed":
      return "Review";
    case "round_opened":
      return "Round";
  }
}

function calculationEventsForLogEvent(input: {
  event: CombatLogEventPresentation;
  events: readonly ProjectedCombatHistoryEvent[];
}): ProjectedCombatHistoryEvent[] {
  const directIds = new Set(input.event.sourceEventIds);
  return input.events.filter((event) => {
    if (directIds.has(event.id)) return true;
    if (input.event.proposalId && proposalId(event) === input.event.proposalId) {
      return input.event.category === "contest" && event.type.endsWith("_roll");
    }
    if (
      !input.event.attackResultId ||
      event.id === input.event.id ||
      event.facts.involvedOutcome?.attackResultId !== input.event.attackResultId
    ) {
      return false;
    }
    // Compatibility attachment is type-scoped to the exact canonical result kind. Sharing an
    // attackResultId does not make the child parry or Brawling calculation part of the Attack.
    if (input.event.category === "attack") return event.type === "attack";
    if (input.event.category === "defense") return event.type === "parry";
    if (input.event.category === "damage") {
      return (
        event.type === "damage_proposed" ||
        event.type === "damage_committed" ||
        event.type === "critical" ||
        event.type === "hit_location"
      );
    }
    return false;
  });
}

function calculationsForEvents(input: {
  events: readonly ProjectedCombatHistoryEvent[];
  participantId: string;
  viewer: BuildCombatStepResultPresentationInput["viewer"];
}): CombatCalculationPresentation[] {
  const visibleEvents =
    input.viewer.kind === "gm"
      ? input.events
      : input.events.filter((event) => event.ownerParticipantId === input.participantId);
  return buildCombatEventResultModel(visibleEvents, {
    calculationStage: "panel_active_calculation_presentation",
    resultStage: "panel_active_attack_parry_result_presentation",
  }).items.flatMap((item) =>
    item.calculations.map((calculation) =>
      input.viewer.kind === "gm" && calculation.visibility !== "gm_full"
        ? { ...calculation, visibility: "gm_full" as const }
        : calculation,
    ),
  );
}

function resolvedProposalIds(input: {
  events: readonly ProjectedCombatHistoryEvent[];
  logEvents: readonly CombatLogEventPresentation[];
}): ReadonlySet<string> {
  return new Set([
    ...input.logEvents.flatMap((event) =>
      event.proposalId &&
      (event.summaryFacts.kind === "contest_resolved" ||
        event.summaryFacts.kind === "distance_changed")
        ? [event.proposalId]
        : [],
    ),
    ...input.events.flatMap((event) =>
      event.type === "adjust_distance_result" || event.type === "feint_result"
        ? [proposalId(event)].filter((id): id is string => Boolean(id))
        : [],
    ),
  ]);
}

interface OrderedEntry {
  readonly entry: CombatStepResultEntryPresentation;
  readonly order: number;
  readonly semanticOrder: number;
}

function groupActionInstanceId(entry: CombatStepResultEntryPresentation): string | undefined {
  const envelopeIdentity = entry.resultEnvelopes?.find(
    (envelope) => envelope.actionInstanceId,
  )?.actionInstanceId;
  if (envelopeIdentity) return envelopeIdentity;
  if (entry.attackResultId && (entry.category === "critical" || entry.category === "damage")) {
    return `${entry.attackResultId}:damage`;
  }
  if (entry.attackResultId && (entry.category === "attack" || entry.category === "defense")) {
    return entry.attackResultId;
  }
  return entry.proposalId ?? entry.opportunityId;
}

function ledgerFragment(input: {
  entry: CombatStepResultEntryPresentation;
  sequence: number;
  sortOrder: number;
}): CombatResultLedgerFragmentInput {
  const actor = input.entry.actor;
  const target = input.entry.target;
  return {
    actionInstanceId: groupActionInstanceId(input.entry),
    processId: input.entry.processId,
    sortOrder: input.sortOrder,
    result: {
      actor: actor
        ? {
            hidden: actor.hidden,
            id: actor.id,
            label: actor.label,
          }
        : undefined,
      calculations: input.entry.calculations,
      heading: input.entry.heading,
      id: input.entry.id,
      outcomeRows:
        input.entry.outcome && input.entry.outcome !== input.entry.summary
          ? [{ key: `${input.entry.id}:outcome`, text: input.entry.outcome }]
          : [],
      resultEnvelopes: input.entry.resultEnvelopes ?? [],
      sequence: input.sequence,
      sourceEventIds: input.entry.sourceEventIds,
      state: input.entry.state,
      summary: input.entry.summary,
      target: target
        ? {
            hidden: target.hidden,
            id: target.id,
            label: target.label,
          }
        : undefined,
    },
  };
}

function logEntry(input: {
  event: CombatLogEventPresentation;
  events: readonly ProjectedCombatHistoryEvent[];
  participantId: string;
  resolvedProposalIds: ReadonlySet<string>;
  viewer: BuildCombatStepResultPresentationInput["viewer"];
}): OrderedEntry | undefined {
  const category = categoryForLogEvent(input.event);
  if (!category) return undefined;
  const calculationEvents = calculationEventsForLogEvent({
    event: input.event,
    events: input.events,
  });
  const directSequence = calculationEvents.length
    ? Math.min(...calculationEvents.map((event) => event.sequence))
    : input.event.sequence;
  const pending =
    input.event.state === "provisional" ||
    (input.event.summaryFacts.kind === "maneuver_attempt" &&
      Boolean(input.event.proposalId) &&
      !input.resolvedProposalIds.has(input.event.proposalId!));
  return {
    entry: {
      actor: subject(input.event.actor),
      attackResultId: input.event.attackResultId,
      calculations: calculationsForEvents({
        events: calculationEvents,
        participantId: input.participantId,
        viewer: input.viewer,
      }),
      category,
      heading: headingForLogEvent(input.event),
      id: `current-step:${input.event.id}`,
      opportunityId: input.event.opportunityId,
      processId: input.event.processId,
      proposalId: input.event.proposalId,
      sourceEventIds: input.event.sourceEventIds,
      state: pending ? "pending" : "final",
      summary: input.event.summary,
      target: subject(input.event.target),
    },
    order: directSequence,
    semanticOrder: input.event.category === "attack" ? 0 : input.event.sequence,
  };
}

function identityLabel(
  event: ProjectedCombatHistoryEvent,
  role: "actor" | "attacker" | "defender" | "target",
): string | undefined {
  return event.identities.find((identity) => identity.role === role)?.displayName;
}

function identitySubject(
  event: ProjectedCombatHistoryEvent,
  role: "actor" | "attacker" | "defender" | "roller" | "target",
): CombatPresentationSubject | undefined {
  const identity = event.identities.find((candidate) => candidate.role === role);
  return identity
    ? {
        hidden: identity.visibility === "unseen" || !identity.participantId,
        id: identity.participantId,
        label: identity.displayName,
      }
    : undefined;
}

function visibleOutcome(event: ProjectedCombatHistoryEvent, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = fact(event, key);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function supplementalEntries(input: {
  events: readonly ProjectedCombatHistoryEvent[];
  logEvents: readonly CombatLogEventPresentation[];
  participantId: string;
  viewer: BuildCombatStepResultPresentationInput["viewer"];
}): OrderedEntry[] {
  const loggedSourceIds = new Set(input.logEvents.flatMap((event) => event.sourceEventIds));
  const loggedContestProposalIds = new Set(
    input.logEvents.flatMap((event) =>
      event.summaryFacts.kind === "contest_resolved" && event.proposalId ? [event.proposalId] : [],
    ),
  );
  const loggedDistanceProposalIds = new Set(
    input.logEvents.flatMap((event) =>
      event.summaryFacts.kind === "distance_changed" && event.proposalId ? [event.proposalId] : [],
    ),
  );

  const resolvedObservationAttemptIds = new Set(
    input.events.flatMap((event) => {
      const attemptId = visibleOutcome(event, "observationAttemptId");
      return event.type === "observation" &&
        typeof attemptId === "string" &&
        visibleOutcome(event, "difference") !== undefined
        ? [attemptId]
        : [];
    }),
  );
  const canonicalResolvedObservationEventIdByAttempt = new Map<string, string>();
  for (const event of [...input.events].sort(
    (left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id),
  )) {
    const attemptId = visibleOutcome(event, "observationAttemptId");
    if (
      event.type !== "observation" ||
      typeof attemptId !== "string" ||
      visibleOutcome(event, "difference") === undefined
    ) {
      continue;
    }
    const existingId = canonicalResolvedObservationEventIdByAttempt.get(attemptId);
    const existing = existingId
      ? input.events.find((candidate) => candidate.id === existingId)
      : undefined;
    const score =
      Number(Boolean(event.facts.privateCalculation?.finalTotal)) +
      Number(Boolean(event.facts.gmReview?.targetTotal));
    const existingScore = existing
      ? Number(Boolean(existing.facts.privateCalculation?.finalTotal)) +
        Number(Boolean(existing.facts.gmReview?.targetTotal))
      : -1;
    if (score >= existingScore) {
      canonicalResolvedObservationEventIdByAttempt.set(attemptId, event.id);
    }
  }

  return input.events.flatMap((event): OrderedEntry[] => {
    if (event.type === "observation") {
      const observationStatus = visibleOutcome(event, "observationStatus");
      const noProgressReason = visibleOutcome(event, "observationNoProgressReason");
      const observationAttemptId = visibleOutcome(event, "observationAttemptId");
      if (
        typeof observationAttemptId === "string" &&
        visibleOutcome(event, "difference") !== undefined &&
        canonicalResolvedObservationEventIdByAttempt.get(observationAttemptId) !== event.id
      ) {
        return [];
      }
      if (
        observationStatus === "period_complete" &&
        typeof observationAttemptId === "string" &&
        resolvedObservationAttemptIds.has(observationAttemptId)
      ) {
        return [];
      }
      const observer = identitySubject(event, "actor") ?? identitySubject(event, "roller");
      const target = identitySubject(event, "target");
      const targetLabel = target?.label ?? "opponent";
      if (
        observationStatus === "progress" ||
        observationStatus === "no_progress" ||
        observationStatus === "period_complete"
      ) {
        const progress = visibleOutcome(event, "roundsTowardNextAttempt");
        const required = visibleOutcome(event, "requiredQualifyingRounds");
        return [
          {
            entry: {
              actor: observer,
              calculations: [],
              category: "review",
              heading: `Observe Opponent — ${targetLabel}`,
              id: `current-step:${event.id}`,
              sourceEventIds: [event.id],
              state: observationStatus === "period_complete" ? "pending" : "final",
              summary:
                observationStatus === "no_progress"
                  ? noProgressReason === "observer_hit"
                    ? "No progress · observer was hit"
                    : "No progress"
                  : observationStatus === "period_complete"
                    ? "Observation period complete · roll pending"
                    : typeof progress === "number" && typeof required === "number"
                      ? `Progress ${progress} / ${required}`
                      : "Observation progress recorded",
              target,
            },
            order: event.sequence,
            semanticOrder: 0,
          },
        ];
      }
      const candidateBonus = visibleOutcome(event, "candidateBonus");
      const bestBonus = visibleOutcome(event, "bestBonusAfter");
      const difference = visibleOutcome(event, "difference");
      const observerTotal =
        input.viewer.kind === "gm"
          ? event.facts.gmReview?.observerTotal
          : event.facts.privateCalculation?.finalTotal;
      const targetTotal =
        input.viewer.kind === "gm" ? event.facts.gmReview?.targetTotal : undefined;
      const margin =
        typeof difference === "number" ? formatObservationContestDifference(difference) : "";
      const bonus =
        typeof candidateBonus === "number" && typeof bestBonus === "number"
          ? `result +${candidateBonus}% · best +${bestBonus}%`
          : "";
      const comparison =
        typeof observerTotal === "number" && typeof targetTotal === "number"
          ? `Observer ${observerTotal} vs opponent ${targetTotal}`
          : typeof observerTotal === "number"
            ? `Roll ${observerTotal}`
            : margin || bonus || "Observation result recorded";
      return [
        {
          entry: {
            actor: observer,
            calculations: calculationsForEvents({
              events: [event],
              participantId: input.participantId,
              viewer: input.viewer,
            }),
            category: "contest",
            heading: `Observe Opponent — ${targetLabel}`,
            id: `current-step:${event.id}`,
            outcome: [margin, bonus].filter(Boolean).join(" · "),
            sourceEventIds: [event.id],
            state: "final",
            summary: comparison,
            target,
          },
          order: event.sequence,
          semanticOrder: 0,
        },
      ];
    }

    if (event.type === "combat_experience" && !loggedSourceIds.has(event.id)) {
      const participant = identitySubject(event, "actor") ?? identitySubject(event, "roller");
      const maySeeOwnCalculation =
        input.viewer.kind === "gm" || event.ownerParticipantId === input.participantId;
      const finalTotal = maySeeOwnCalculation
        ? event.facts.privateCalculation?.finalTotal
        : undefined;
      const difficulty = maySeeOwnCalculation
        ? event.facts.privateCalculation?.difficulty
        : undefined;
      const success = visibleOutcome(event, "success");
      const phaseAttackCancelled = visibleOutcome(event, "phaseAttackCancelled") === true;
      const modifierValue = visibleOutcome(event, "modifierValue");
      const phaseConsequence = event.phase
        ? phaseAttackCancelled
          ? "the attack is cancelled."
          : typeof modifierValue === "number" && modifierValue < 0
            ? `the attack may continue with ${modifierValue} Skill/OB.`
            : "the attack may continue."
        : undefined;
      return [
        {
          entry: {
            actor: participant,
            calculations: calculationsForEvents({
              events: [event],
              participantId: input.participantId,
              viewer: input.viewer,
            }),
            category: "review",
            heading: "Combat Experience",
            id: `current-step:${event.id}`,
            opportunityId: event.opportunityId,
            outcome:
              typeof finalTotal === "number" && typeof difficulty === "number"
                ? `Result: ${finalTotal} vs ${difficulty}`
                : undefined,
            sourceEventIds: [event.id],
            state: "final",
            summary:
              success === true
                ? phaseConsequence
                  ? `Succeeded — ${phaseConsequence}`
                  : "Succeeded."
                : success === false
                  ? phaseConsequence
                    ? `Failed — ${phaseConsequence}`
                    : "Failed."
                  : "Combat Experience roll completed.",
          },
          order: event.sequence,
          semanticOrder: 0,
        },
      ];
    }

    if (event.type === "offensive_parry_brawling") {
      if (visibleOutcome(event, "resolved") !== true) return [];
      const contestId = visibleOutcome(event, "contestId");
      if (typeof contestId !== "string") return [];
      const contestEvents = input.events.filter(
        (candidate) =>
          candidate.type === "offensive_parry_brawling" &&
          visibleOutcome(candidate, "contestId") === contestId,
      );
      const controller = identitySubject(event, "defender") ?? identitySubject(event, "actor");
      const affected = identitySubject(event, "attacker") ?? identitySubject(event, "target");
      const winnerParticipantId = visibleOutcome(event, "winnerParticipantId");
      const controllerWon =
        visibleOutcome(event, "contactEstablished") === true &&
        winnerParticipantId === controller?.id;
      const participantIsController = controller?.id === input.participantId;
      const participantIsAffected = affected?.id === input.participantId;
      const controllerName = controller?.label ?? "The defender";
      const affectedName = affected?.label ?? "the attacker";
      const summary = controllerWon
        ? participantIsController
          ? `You won the Brawling contest. Continued contact was established. ${affectedName} is Unbalanced (−2%).`
          : participantIsAffected
            ? `You lost the Brawling contest. ${controllerName} established continued contact. You are Unbalanced (−2%).`
            : `${controllerName} established continued contact. ${affectedName} is Unbalanced (−2%).`
        : participantIsController
          ? "You did not win the Brawling contest. Continued contact was not established."
          : participantIsAffected
            ? "You resisted the attempt. No continued contact was established."
            : "Continued contact was not established.";
      return [
        {
          entry: {
            actor: controller,
            attackResultId:
              typeof visibleOutcome(event, "attackResultId") === "string"
                ? (visibleOutcome(event, "attackResultId") as string)
                : undefined,
            calculations: calculationsForEvents({
              events: contestEvents,
              participantId: input.participantId,
              viewer: input.viewer,
            }),
            category: "contest",
            heading: "Offensive Parry — Brawling",
            id: `current-step:${contestId}:result`,
            opportunityId: event.opportunityId,
            outcome: controllerWon
              ? "Continued contact established · Unbalanced −2%"
              : "Continued contact not established",
            sourceEventIds: contestEvents.map((candidate) => candidate.id),
            state: "final",
            summary,
            target: affected,
          },
          order: event.sequence,
          semanticOrder: 0,
        },
      ];
    }

    if (event.type === "continued_contact_maintenance") {
      if (visibleOutcome(event, "resolved") !== true) return [];
      const contestId = visibleOutcome(event, "contestId");
      if (typeof contestId !== "string") return [];
      const contestEvents = input.events.filter(
        (candidate) =>
          candidate.type === "continued_contact_maintenance" &&
          visibleOutcome(candidate, "contestId") === contestId,
      );
      const controller = identitySubject(event, "actor");
      const affected = identitySubject(event, "target");
      const maintained = visibleOutcome(event, "contactMaintained") === true;
      const outcome = visibleOutcome(event, "outcome");
      const controllerName = controller?.label ?? "The controller";
      const affectedName = affected?.label ?? "the defender";
      const participantIsController = controller?.id === input.participantId;
      const participantIsAffected = affected?.id === input.participantId;
      const summary = maintained
        ? participantIsController
          ? `Continued Contact maintained. ${affectedName} remains Unbalanced. You choose engagement distance for the next round.`
          : participantIsAffected
            ? `Continued Contact maintained. You remain Unbalanced. ${controllerName} chooses engagement distance for the next round.`
            : `Continued Contact maintained. ${affectedName} remains Unbalanced.`
        : participantIsAffected
          ? "You escaped Continued Contact. Unbalanced was removed. Ordinary distance control resumes."
          : participantIsController
            ? "Continued Contact was broken. Unbalanced was removed. Ordinary distance control resumes."
            : "Continued Contact was broken. Unbalanced was removed. Ordinary distance control resumes.";
      return [
        {
          entry: {
            actor: controller,
            calculations: calculationsForEvents({
              events: contestEvents,
              participantId: input.participantId,
              viewer: input.viewer,
            }),
            category: "contest",
            heading: "Continued Contact — Maintenance",
            id: `current-step:${contestId}:result`,
            outcome: maintained
              ? "Continued Contact maintained · Unbalanced remains"
              : outcome === "tie"
                ? "Tie · Continued Contact broken"
                : "Continued Contact broken · Unbalanced removed",
            sourceEventIds: contestEvents.map((candidate) => candidate.id),
            state: "final",
            summary,
            target: affected,
          },
          order: event.sequence,
          semanticOrder: 0,
        },
      ];
    }

    if (event.type === "adjust_distance_result") {
      const id = proposalId(event);
      if (!id || loggedContestProposalIds.has(id)) return [];
      const outcome = fact(event, "outcome");
      const actor = identitySubject(event, "actor") ?? identitySubject(event, "attacker");
      const target = identitySubject(event, "target") ?? identitySubject(event, "defender");
      const actorLabel = actor?.label ?? identityLabel(event, "attacker") ?? "The initiator";
      const won = outcome === "successful" || outcome === "allowed";
      const rollEvents = input.events.filter(
        (candidate) => candidate.type === "adjust_distance_roll" && proposalId(candidate) === id,
      );
      return [
        {
          entry: {
            actor,
            calculations: calculationsForEvents({
              events: rollEvents,
              participantId: input.participantId,
              viewer: input.viewer,
            }),
            category: "contest",
            heading: "Contest result",
            id: `current-step:${event.id}:contest`,
            outcome: won ? "Won" : "Lost",
            proposalId: id,
            sourceEventIds: [event.id, ...rollEvents.map((roll) => roll.id)],
            state: "final",
            summary: `${actorLabel} ${won ? "won" : "lost"} the distance contest.`,
            target,
          },
          order: event.sequence,
          semanticOrder: 0,
        },
      ];
    }

    if (event.type === "adjust_distance_committed") {
      const id = proposalId(event);
      const previous = fact(event, "previousDistance");
      const committed = fact(event, "committedDistance");
      if (
        !id ||
        loggedDistanceProposalIds.has(id) ||
        typeof previous !== "number" ||
        typeof committed !== "number" ||
        previous !== committed
      ) {
        return [];
      }
      return [
        {
          entry: {
            actor: identitySubject(event, "actor") ?? identitySubject(event, "attacker"),
            calculations: [],
            category: "distance",
            heading: "Distance",
            id: `current-step:${event.id}:unchanged-distance`,
            outcome: `Distance remained ${committed}.`,
            proposalId: id,
            sourceEventIds: [event.id],
            state: "final",
            summary: `Distance remained ${committed}.`,
            target: identitySubject(event, "target") ?? identitySubject(event, "defender"),
          },
          order: event.sequence,
          semanticOrder: 1,
        },
      ];
    }

    if (event.type === "damage_proposed" && visibleOutcome(event, "grazing") === true) {
      const actor = identitySubject(event, "attacker") ?? identitySubject(event, "actor");
      const target = identitySubject(event, "defender") ?? identitySubject(event, "target");
      const rawDamage = visibleOutcome(event, "rawGrazingDamage");
      const expression = visibleOutcome(event, "damageRollExpression");
      if (typeof rawDamage !== "number") return [];
      const actorIsViewedParticipant = actor?.id === input.participantId;
      const actorLabel = actor?.label ?? "The attacker";
      const targetLabel = target?.label ?? "the defender";
      const calculations =
        input.viewer.kind === "gm" || actorIsViewedParticipant
          ? buildCombatCalculationPresentations(event).map((calculation) =>
              input.viewer.kind === "gm"
                ? { ...calculation, visibility: "gm_full" as const }
                : calculation,
            )
          : [];
      const summary =
        input.viewer.kind === "gm"
          ? `${actorLabel} rolled ${rawDamage}${typeof expression === "string" ? ` on ${expression}` : ""} against ${targetLabel}. Review damage and effects.`
          : actorIsViewedParticipant
            ? `You rolled ${rawDamage}${typeof expression === "string" ? ` on ${expression}` : ""}. Damage is awaiting GM review.`
            : `${actorLabel} rolled ${rawDamage} damage. Damage is awaiting GM review.`;
      return [
        {
          entry: {
            actor,
            attackResultId:
              typeof fact(event, "attackResultId") === "string"
                ? (fact(event, "attackResultId") as string)
                : undefined,
            calculations,
            category: "damage",
            heading: "Graze damage",
            id: `current-step:${event.id}:graze-roll`,
            outcome: `Rolled ${rawDamage}${typeof expression === "string" ? ` on ${expression}` : ""}.`,
            sourceEventIds: [event.id],
            state: "final",
            summary,
            target,
          },
          order: event.sequence,
          semanticOrder: 1,
        },
      ];
    }

    if (
      (event.type === "hit_location" || event.type === "critical") &&
      !loggedSourceIds.has(event.id)
    ) {
      const model = buildCombatEventResultModel([event], {
        calculationStage: "panel_active_calculation_presentation",
        resultStage: "panel_active_attack_parry_result_presentation",
      }).items[0];
      if (!model) return [];
      return [
        {
          entry: {
            actor: identitySubject(event, "attacker") ?? identitySubject(event, "actor"),
            attackResultId:
              typeof fact(event, "attackResultId") === "string"
                ? (fact(event, "attackResultId") as string)
                : undefined,
            calculations: calculationsForEvents({
              events: [event],
              participantId: input.participantId,
              viewer: input.viewer,
            }),
            category: "critical",
            heading: model.title,
            id: `current-step:${event.id}`,
            outcome:
              model.outcomeRows.map((row) => row.text.replace(/^Result: /, "")).join(" · ") ||
              undefined,
            sourceEventIds: [event.id],
            state: "final",
            summary: model.summary,
            target: identitySubject(event, "defender") ?? identitySubject(event, "target"),
          },
          order: event.sequence,
          semanticOrder: event.type === "hit_location" ? 0 : 1,
        },
      ];
    }
    if (event.type === "health_check" && !loggedSourceIds.has(event.id)) {
      const participant = identitySubject(event, "actor");
      const success = visibleOutcome(event, "success");
      return [
        {
          entry: {
            actor: participant,
            calculations: calculationsForEvents({
              events: [event],
              participantId: input.participantId,
              viewer: input.viewer,
            }),
            category: "review",
            heading: "Health check",
            id: `current-step:${event.id}`,
            outcome:
              success === true
                ? "Health check succeeded."
                : success === false
                  ? "Health check failed."
                  : undefined,
            sourceEventIds: [event.id],
            state: "final",
            summary: `${participant?.label ?? "The participant"} completed a Health check.`,
          },
          order: event.sequence,
          semanticOrder: 0,
        },
      ];
    }
    if (event.type === "distance_control_result" && !loggedSourceIds.has(event.id)) {
      const winnerId = visibleOutcome(event, "winnerParticipantId");
      const winner =
        typeof winnerId === "string"
          ? event.identities.find((identity) => identity.participantId === winnerId)?.displayName
          : undefined;
      const outcome = visibleOutcome(event, "outcome");
      return [
        {
          entry: {
            actor: identitySubject(event, "actor"),
            // Projected history currently omits the pair/proposal identity from these roll
            // records. Do not guess and accidentally attach another pair's calculation.
            calculations: [],
            category: "contest",
            heading: "Distance control",
            id: `current-step:${event.id}`,
            outcome: typeof outcome === "string" ? outcome.replaceAll("_", " ") : undefined,
            sourceEventIds: [event.id],
            state: "final",
            summary: winner
              ? `${winner} won the distance-control contest.`
              : "The distance-control contest was resolved.",
            target: identitySubject(event, "target"),
          },
          order: event.sequence,
          semanticOrder: 0,
        },
      ];
    }
    if (event.resultEnvelope?.publicCombatNote && !loggedSourceIds.has(event.id)) {
      return [
        {
          entry: {
            actor: identitySubject(event, "actor") ?? identitySubject(event, "attacker"),
            calculations: calculationsForEvents({
              events: [event],
              participantId: input.participantId,
              viewer: input.viewer,
            }),
            category: "review",
            heading: event.resultEnvelope.conciseOutcome.label,
            id: `current-step:${event.id}`,
            resultEnvelopes: [event.resultEnvelope],
            sourceEventIds: [event.id],
            state: event.status === "proposed" ? "pending" : "final",
            summary:
              event.resultEnvelope.conciseOutcome.details.join(" · ") ||
              event.resultEnvelope.conciseOutcome.label,
            target: identitySubject(event, "target") ?? identitySubject(event, "defender"),
          },
          order: event.sequence,
          semanticOrder: 0,
        },
      ];
    }
    return [];
  });
}

/**
 * Projects the viewed participant's accumulated, viewer-safe outcomes for one active top-level
 * combat boundary. Combat Log facts provide narrative; projected history events only attach
 * already-sanitized calculation details and narrow result facts missing from the initial log.
 */
export function buildCombatStepResultPresentation(
  input: BuildCombatStepResultPresentationInput,
): CombatStepResultPresentation {
  const base = {
    boundary: input.boundary,
    emptyState: EMPTY_STATE,
    encounterId: input.encounterId,
    encounterRevision: input.encounterRevision,
    participantId: input.participantId,
    phase: phaseForBoundary(input.boundary),
    roundNumber: input.roundNumber,
  };
  if (
    input.combatLog.encounterId !== input.encounterId ||
    input.combatLog.sourceRevision !== input.encounterRevision
  ) {
    return { ...base, entries: [], groups: [] };
  }

  const events = input.events.filter((event) => event.roundNumber === input.roundNumber);
  const logEvents = input.combatLog.events.filter(
    (event) =>
      event.roundNumber === input.roundNumber && eventBelongsToBoundary(event, input.boundary),
  );
  const resolved = resolvedProposalIds({ events, logEvents });
  const ordered = logEvents.flatMap((event) => {
    const sourceEvents = calculationEventsForLogEvent({ event, events });
    if (
      !eventInvolvesParticipant({
        event,
        participantId: input.participantId,
        sourceEvents,
      })
    ) {
      return [];
    }
    const entry = logEntry({
      event,
      events,
      participantId: input.participantId,
      resolvedProposalIds: resolved,
      viewer: input.viewer,
    });
    return entry ? [entry] : [];
  });

  const boundaryEventSteps = new Set(
    input.boundary === "phase1_resolution"
      ? ["phase_1_actions", "review_phase_2_actions", "phase_1_damage"]
      : input.boundary === "phase2_resolution"
        ? ["phase_2_actions", "review_phase_2_damage", "phase_2_damage"]
        : input.boundary === "round_end" || input.boundary === "round_boundary"
          ? ["round_summary"]
          : input.boundary === "declaration"
            ? ["select_actions"]
            : [],
  );
  const relevantSupplementEvents = events.filter(
    (event) =>
      boundaryEventSteps.has(event.step) &&
      (event.ownerParticipantId === input.participantId ||
        event.identities.some((identity) => identity.participantId === input.participantId)),
  );
  ordered.push(
    ...supplementalEntries({
      events: relevantSupplementEvents,
      logEvents,
      participantId: input.participantId,
      viewer: input.viewer,
    }),
  );

  const orderedEntries = ordered
    .sort(
      (left, right) =>
        left.order - right.order ||
        left.semanticOrder - right.semanticOrder ||
        left.entry.id.localeCompare(right.entry.id),
    )
    .map(({ entry, order }) => {
      const resultEnvelopes = events.flatMap((event) =>
        entry.sourceEventIds.includes(event.id) && event.resultEnvelope
          ? [event.resultEnvelope]
          : [],
      );
      return {
        entry: resultEnvelopes.length ? { ...entry, resultEnvelopes } : entry,
        sequence: order,
      };
    });
  const entries = orderedEntries.map(({ entry }) => entry);
  return {
    ...base,
    entries,
    groups: buildCombatResultGroups(
      orderedEntries.map(({ entry, sequence }, sortOrder) =>
        ledgerFragment({ entry, sequence, sortOrder }),
      ),
    ),
  };
}
