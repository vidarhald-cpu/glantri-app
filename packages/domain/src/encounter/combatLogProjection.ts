import { getCombatDeclarationActionLabel } from "./combatDeclarationValidation";
import type { CombatAdjustDistanceProposal } from "./combatAdjustDistance";
import type { CombatFeintProposal } from "./combatFeint";
import { getCombatRoundTimelineRoundStates, type CombatRoundState } from "./combatRoundManager";
import {
  isCombatGenericActionLive,
  isCombatGuardedItemAction,
  type CombatGenericAction,
  type CombatGenericActionStatus,
  type CombatItemInteractionOperation,
} from "./combatGenericAction";
import {
  combatCriticalBleedControlStateSchema,
  getCombatCriticalBleedControlStateLabel,
} from "./combatCriticalRuntime";
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

export type CombatLogPresentationTargetKind =
  | "attack"
  | "damage"
  | "declaration"
  | "defense"
  | "maneuver"
  | "participant_review";

export interface CombatLogSubjectPresentation {
  readonly displayName: string;
  /** Omitted when a viewer is not allowed to identify this subject. */
  readonly participantId?: string;
}

export type CombatLogViewer =
  | { readonly kind: "gm" }
  | {
      readonly controlledParticipantIds: ReadonlySet<string>;
      readonly kind: "player";
      readonly visibleParticipantIds: ReadonlySet<string>;
    };

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
      readonly parryPurpose?: "ordinary_defense" | "offensive_parry";
      readonly sourceAttackOutcome?: "hit" | "missed";
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
    }
  | {
      readonly bleedKind: "external" | "internal";
      readonly kind: "bleed_treatment";
      readonly nextState: string;
      readonly previousState: string;
    }
  | {
      readonly kind: "task_resolved";
      readonly rollOutcome?: "failed" | "succeeded";
      readonly taskId: string;
    }
  | {
      readonly actionId: string;
      readonly itemId: string;
      readonly itemOperation: CombatItemInteractionOperation;
      readonly kind: "item_action_declared";
      readonly live: boolean;
      readonly status: CombatGenericActionStatus;
    };

export interface CombatLogEventPresentation {
  readonly actionKind?: string;
  readonly actor?: CombatLogSubjectPresentation;
  readonly attackResultId?: string;
  /**
   * Explicit result audience. When present, only a viewer controlling one of these participants
   * may receive the event at all. Absent means the entry carries no audience restriction and the
   * existing subject-level sanitization alone governs it.
   */
  readonly audienceParticipantIds?: readonly string[];
  readonly category: CombatLogEventCategory;
  /** @deprecated Use presentationTargetId for Action Outcome selection. */
  readonly detailResultId?: string;
  readonly encounterId: string;
  readonly id: string;
  readonly occurredAt?: string;
  readonly opportunityId?: string;
  readonly phase?: CombatLogPhase;
  readonly processId?: string;
  readonly proposalId?: string;
  readonly presentationTargetId?: string;
  readonly presentationTargetKind?: CombatLogPresentationTargetKind;
  readonly presentationTargetSourceId?: string;
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

function possessiveDisplayName(name: string): string {
  if (name === "you") return "your";
  if (name === "another combatant") return "another combatant's";
  return name.endsWith("s") ? `${name}'` : `${name}’s`;
}

function replaceSubjectWording(
  summary: string,
  subject: CombatLogSubjectPresentation,
  replacement: string,
): string {
  const possessive = possessiveDisplayName(subject.displayName);
  const replacementPossessive = possessiveDisplayName(replacement);
  return summary
    .split(possessive)
    .join(replacementPossessive)
    .split(subject.displayName)
    .join(replacement);
}

function projectSubjectForViewer(input: {
  subject: CombatLogSubjectPresentation | undefined;
  viewer: CombatLogViewer;
}): { subject?: CombatLogSubjectPresentation; replacement: string | undefined; involved: boolean } {
  if (!input.subject) return { involved: false, replacement: undefined };
  if (input.viewer.kind === "gm") {
    return { involved: false, replacement: input.subject.displayName, subject: input.subject };
  }

  const participantId = input.subject.participantId;
  const involved = Boolean(
    participantId && input.viewer.controlledParticipantIds.has(participantId),
  );
  const visible = Boolean(participantId && input.viewer.visibleParticipantIds.has(participantId));
  if (involved) {
    return {
      involved: true,
      replacement: "you",
      subject: { displayName: "you", participantId },
    };
  }
  if (visible) {
    return { involved: false, replacement: input.subject.displayName, subject: input.subject };
  }
  return {
    involved: false,
    replacement: "another combatant",
    subject: { displayName: "another combatant" },
  };
}

/**
 * Issue #798 (L7). A GM-hidden participant's identity survived anonymisation
 * through the event ids. `id` is built as `combat-log:${eventId}` and
 * `sourceEventIds` carries the raw engine event id, both unconditionally and in
 * neither branch of the `mayInspect` gate below — and a declaration event id
 * embeds `scenario-<ScenarioParticipant.id>`, which the same player's Scenario
 * session body resolves to a display name. The inspection ids leak the same id
 * whenever `mayInspect` is true, which is exactly when the hidden participant
 * acts against the viewer.
 *
 * Every occurrence of an anonymised participant's id is replaced, in every
 * id-bearing field of every event in the response, with one shared constant.
 * PO ruling D2 forbids a placeholder that signals, so the token is deliberately
 * not derived from the hidden id: a hash of it would still correlate the
 * participant across requests, whereas every hidden participant collapses onto
 * the same token here. Consistent replacement rather than omission keeps the
 * ids usable for the correlation the client already performs between
 * `sourceEventIds`, `id` and the result ids, which a player legitimately needs
 * for an attack declared against them.
 */
const REDACTED_PARTICIPANT_ID_TOKEN = "hidden-participant";

function redactParticipantIdentity<T extends string | undefined>(
  value: T,
  redactedParticipantIds: readonly string[],
): T {
  if (!value || redactedParticipantIds.length === 0) return value;
  let redacted: string = value;
  for (const participantId of redactedParticipantIds) {
    if (!redacted.includes(participantId)) continue;
    redacted = redacted.split(participantId).join(REDACTED_PARTICIPANT_ID_TOKEN);
  }
  return redacted as T;
}

/**
 * Transforms one canonical GM-full log without creating or reordering events.
 * The viewer stage only changes structured subjects, wording, and inspectability.
 */
export function projectCombatLogForViewer(input: {
  projection: CombatLogProjection;
  /** The active declaration round remains private between participants until the GM closes it. */
  unpublishedDeclarationRoundNumber?: number;
  viewer: CombatLogViewer;
}): CombatLogProjection {
  if (input.viewer.kind === "gm") return input.projection;
  const viewer = input.viewer;

  /**
   * Resolved over the whole projection before any event is rewritten, so one
   * event cannot keep an id another event redacted. A subject is redactable
   * when this viewer neither controls it nor may see it — the same condition
   * `projectSubjectForViewer` uses to replace its name with "another combatant".
   */
  const redactedParticipantIds = [
    ...new Set(
      input.projection.events
        .flatMap((event) => [event.actor?.participantId, event.target?.participantId])
        .filter((participantId): participantId is string => Boolean(participantId))
        .filter(
          (participantId) =>
            !viewer.controlledParticipantIds.has(participantId) &&
            !viewer.visibleParticipantIds.has(participantId),
        ),
    ),
    // Longest first, so a bare id never partially rewrites its prefixed alias.
  ].sort((left, right) => right.length - left.length);

  return deepFreeze({
    ...input.projection,
    events: input.projection.events
      .filter(
        (event) =>
          event.category !== "declaration" ||
          event.roundNumber !== input.unpublishedDeclarationRoundNumber ||
          Boolean(
            event.actor?.participantId &&
            viewer.controlledParticipantIds.has(event.actor.participantId),
          ),
      )
      // An explicit result audience is authoritative: a viewer outside it never receives the entry.
      .filter(
        (event) =>
          event.audienceParticipantIds === undefined ||
          event.audienceParticipantIds.some((participantId) =>
            viewer.controlledParticipantIds.has(participantId),
          ),
      )
      .map((event) => {
        const actor = projectSubjectForViewer({ subject: event.actor, viewer });
        const target = projectSubjectForViewer({ subject: event.target, viewer });
        const summary =
          actor.replacement && event.actor
            ? replaceSubjectWording(event.summary, event.actor, actor.replacement)
            : event.summary;
        const targetSummary =
          target.replacement && event.target
            ? replaceSubjectWording(summary, event.target, target.replacement)
            : summary;
        const mayInspect = actor.involved || target.involved;
        return {
          ...event,
          ...(event.audienceParticipantIds
            ? {
                audienceParticipantIds: event.audienceParticipantIds.filter((participantId) =>
                  viewer.controlledParticipantIds.has(participantId),
                ),
              }
            : {}),
          actor: actor.subject,
          target: target.subject,
          summary: targetSummary,
          // #798 L7: identity-bearing id fields, redacted before the
          // inspection gate so both branches are covered.
          id: redactParticipantIdentity(event.id, redactedParticipantIds),
          sourceEventIds: event.sourceEventIds.map(
            (sourceEventId) => redactParticipantIdentity(sourceEventId, redactedParticipantIds)!,
          ),
          attackResultId: redactParticipantIdentity(event.attackResultId, redactedParticipantIds),
          detailResultId: redactParticipantIdentity(event.detailResultId, redactedParticipantIds),
          opportunityId: redactParticipantIdentity(event.opportunityId, redactedParticipantIds),
          presentationTargetId: redactParticipantIdentity(
            event.presentationTargetId,
            redactedParticipantIds,
          ),
          presentationTargetSourceId: redactParticipantIdentity(
            event.presentationTargetSourceId,
            redactedParticipantIds,
          ),
          processId: redactParticipantIdentity(event.processId, redactedParticipantIds),
          proposalId: redactParticipantIdentity(event.proposalId, redactedParticipantIds),
          taskId: redactParticipantIdentity(event.taskId, redactedParticipantIds),
          ...(mayInspect
            ? {}
            : {
                attackResultId: undefined,
                detailResultId: undefined,
                opportunityId: undefined,
                presentationTargetId: undefined,
                presentationTargetKind: undefined,
                presentationTargetSourceId: undefined,
                processId: undefined,
                proposalId: undefined,
                taskId: undefined,
              }),
        };
      }),
  });
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
  if (event.type === "declaration" || event.step === "select_actions") return "declaration";
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

function targetFromDeclaration(participantId: string, state: CombatRoundState): string | undefined {
  const declaration = state.participants.find(
    (entry) => entry.participantId === participantId,
  )?.declaration;
  return (
    declaration?.phaseContexts?.phase1?.targetParticipantId ??
    declaration?.phaseContexts?.phase2?.targetParticipantId ??
    declaration?.adjustDistance?.targetParticipantId ??
    declaration?.feint?.targetParticipantId
  );
}

function semanticEventKey(event: CombatStepEvent): string {
  if (event.type === "attack" && event.attackResultId) {
    return `attack:${event.attackResultId}`;
  }
  if (event.type === "parry" && event.attackResultId) {
    return `parry:${event.attackResultId}`;
  }
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
  audienceParticipantIds?: readonly string[];
  category: CombatLogEventCategory;
  detailResultId?: string;
  encounterId: string;
  eventId: string;
  occurredAt?: string | null;
  phase?: CombatLogPhase;
  presentationTargetId?: string;
  presentationTargetKind?: CombatLogPresentationTargetKind;
  presentationTargetSourceId?: string;
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
    ...(input.audienceParticipantIds
      ? { audienceParticipantIds: input.audienceParticipantIds }
      : {}),
    category: input.category,
    detailResultId: input.detailResultId,
    encounterId: input.encounterId,
    id: `combat-log:${input.eventId}`,
    occurredAt: input.occurredAt ?? undefined,
    phase: input.phase,
    presentationTargetId: input.presentationTargetId,
    presentationTargetKind: input.presentationTargetKind,
    presentationTargetSourceId: input.presentationTargetSourceId,
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

function presentationTargetId(
  kind: CombatLogPresentationTargetKind,
  sourceId: string | undefined,
): string | undefined {
  return sourceId ? `combat-presentation:${kind}:${sourceId}` : undefined;
}

function projectDeclaration(input: {
  encounterId: string;
  event: CombatStepEvent;
  labels: ReadonlyMap<string, string>;
  sourceRevision: string;
  state: CombatRoundState;
}): Candidate | undefined {
  const actor = subject(
    input.event.actorParticipantId ?? input.event.ownerParticipantId,
    input.labels,
  );
  if (!actor) return undefined;
  const actionId = stringFact(input.event.facts.involvedOutcome, "actionId");
  const label = actionLabel(actionId);
  const target = subject(targetFromDeclaration(actor.participantId!, input.state), input.labels);
  const targetText = target ? ` against ${target.displayName}` : "";
  return {
    ...baseCandidate({
      actor,
      category: "declaration",
      encounterId: input.encounterId,
      eventId: `${input.event.id}:submitted`,
      occurredAt: input.event.occurredAt,
      phase: "declaration",
      presentationTargetId: presentationTargetId("declaration", input.event.id),
      presentationTargetKind: "declaration",
      presentationTargetSourceId: input.event.id,
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
  const actor = subject(
    input.event.attackerParticipantId ?? input.event.actorParticipantId,
    input.labels,
  );
  const target = subject(
    input.event.defenderParticipantId ?? input.event.targetParticipantId,
    input.labels,
  );
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
      presentationTargetId: presentationTargetId(
        "attack",
        input.event.attackResultId ?? input.event.id,
      ),
      presentationTargetKind: "attack",
      presentationTargetSourceId: input.event.attackResultId ?? input.event.id,
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
  if (
    input.event.status === "not_applicable" ||
    (input.event.type === "participant_su_review" && input.event.status === "proposed")
  ) {
    return undefined;
  }
  const success = booleanFact(input.event.facts.publicOutcome, "success");
  if (success === undefined) return undefined;
  const actor = subject(
    input.event.defenderParticipantId ?? input.event.actorParticipantId,
    input.labels,
  );
  const target = subject(
    input.event.attackerParticipantId ?? input.event.targetParticipantId,
    input.labels,
  );
  if (!actor) return undefined;
  const outcome = success ? "succeeded" : "failed";
  const parryPurpose = stringFact(input.event.facts.publicOutcome, "parryPurpose") as
    | "ordinary_defense"
    | "offensive_parry"
    | undefined;
  const attackHit = booleanFact(input.event.facts.publicOutcome, "attackHit");
  const offensiveParrySummary =
    parryPurpose === "offensive_parry"
      ? success
        ? attackHit === false
          ? `${possessive(target?.displayName ?? "The opponent")} attack missed, but ${actor.displayName} successfully intercepted the attack. Roll Brawling to establish continued contact.`
          : `${actor.displayName} successfully parried ${possessive(target?.displayName ?? "the opponent")} attack. Roll Brawling to establish continued contact.`
        : `${actor.displayName} failed to establish the parry. No Brawling contest was created.`
      : undefined;
  return {
    ...baseCandidate({
      actor,
      category: "defense",
      detailResultId: input.event.parryResultId,
      encounterId: input.encounterId,
      eventId: `${input.event.id}:resolved`,
      occurredAt: input.event.occurredAt,
      phase: phaseForEvent(input.event),
      presentationTargetId: presentationTargetId(
        "defense",
        input.event.parryResultId ?? input.event.id,
      ),
      presentationTargetKind: "defense",
      presentationTargetSourceId: input.event.parryResultId ?? input.event.id,
      roundNumber: input.event.roundNumber,
      sourceEventIds: [input.event.id],
      sourceRevision: input.sourceRevision,
      sourceSequence: input.event.sequence,
      summary: offensiveParrySummary ?? `${possessive(actor.displayName)} parry ${outcome}.`,
      summaryFacts: {
        defense: "parry",
        kind: "defense_resolved",
        outcome,
        parryPurpose,
        sourceAttackOutcome:
          attackHit === false ? "missed" : attackHit === true ? "hit" : undefined,
      },
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
  const criticalTitle = stringFact(input.event.facts.involvedOutcome, "criticalTitle");
  const target = subject(
    input.event.defenderParticipantId ?? input.event.targetParticipantId,
    input.labels,
  );
  if (amount === undefined || !target) return undefined;
  return {
    ...baseCandidate({
      actor: subject(
        input.event.attackerParticipantId ?? input.event.actorParticipantId,
        input.labels,
      ),
      category: "damage",
      detailResultId: input.event.damageResultId,
      encounterId: input.encounterId,
      eventId: `${input.event.id}:damage`,
      occurredAt: input.event.occurredAt,
      phase: phaseForEvent(input.event),
      presentationTargetId: presentationTargetId(
        "damage",
        input.event.damageResultId ?? input.event.id,
      ),
      presentationTargetKind: "damage",
      presentationTargetSourceId: input.event.damageResultId ?? input.event.id,
      roundNumber: input.event.roundNumber,
      sourceEventIds: [input.event.id],
      sourceRevision: input.sourceRevision,
      sourceSequence: input.event.sequence,
      summary: `${target.displayName} suffered ${amount} damage.${criticalTitle ? ` Critical: ${criticalTitle}.` : ""}`,
      summaryFacts: { amount, kind: "damage_committed", source: "attack" },
      target,
    }),
    attackResultId: input.event.attackResultId,
  };
}

function projectCriticalBleedTreatment(input: {
  encounterId: string;
  event: CombatStepEvent;
  labels: ReadonlyMap<string, string>;
  sourceRevision: string;
}): Candidate | undefined {
  const previousState = stringFact(input.event.facts.involvedOutcome, "previousState");
  const nextState = stringFact(input.event.facts.involvedOutcome, "nextState");
  const bleedKind = stringFact(input.event.facts.involvedOutcome, "bleedKind");
  const target = subject(
    input.event.targetParticipantId ?? input.event.ownerParticipantId,
    input.labels,
  );
  if (
    !target ||
    !previousState ||
    !nextState ||
    (bleedKind !== "external" && bleedKind !== "internal")
  ) {
    return undefined;
  }
  return baseCandidate({
    actor: { displayName: "GM" },
    category: "state_change",
    encounterId: input.encounterId,
    eventId: `${input.event.id}:bleed-treatment`,
    occurredAt: input.event.occurredAt,
    phase: phaseForEvent(input.event),
    roundNumber: input.event.roundNumber,
    sourceEventIds: [input.event.id],
    sourceRevision: input.sourceRevision,
    sourceSequence: input.event.sequence,
    summary: `${target.displayName}’s ${bleedKind === "internal" ? "internal " : ""}Bleed changed from ${getCombatCriticalBleedControlStateLabel(combatCriticalBleedControlStateSchema.parse(previousState))} to ${getCombatCriticalBleedControlStateLabel(combatCriticalBleedControlStateSchema.parse(nextState))}.`,
    summaryFacts: { bleedKind, kind: "bleed_treatment", nextState, previousState },
    target,
  });
}

function projectRoundEndReview(input: {
  encounterId: string;
  event: CombatStepEvent;
  labels: ReadonlyMap<string, string>;
  sourceRevision: string;
}): Candidate[] {
  const actor = subject(
    input.event.actorParticipantId ?? input.event.ownerParticipantId,
    input.labels,
  );
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
          presentationTargetId: presentationTargetId(
            "damage",
            `${input.event.id}:bleeding:${index}`,
          ),
          presentationTargetKind: "damage",
          presentationTargetSourceId: `${input.event.id}:bleeding:${index}`,
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
  if (
    input.event.facts.publicOutcome.changed === true &&
    input.event.facts.publicOutcome.workflowOnly !== true
  ) {
    candidates.push(
      baseCandidate({
        actor,
        category: "state_change",
        encounterId: input.encounterId,
        eventId: `${input.event.id}:review`,
        occurredAt: input.event.occurredAt,
        phase: "round_end",
        presentationTargetId: presentationTargetId("participant_review", input.event.id),
        presentationTargetKind: "participant_review",
        presentationTargetSourceId: input.event.id,
        roundNumber: input.event.roundNumber,
        semanticOrder: candidates.length + 1,
        sourceEventIds: [input.event.id],
        sourceRevision: input.sourceRevision,
        sourceSequence: input.event.sequence,
        summary: `${actor.displayName}'s round-end effects were updated.`,
        summaryFacts: { kind: "review_completed", review: "participant" },
      }),
    );
  }
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
        presentationTargetId: presentationTargetId("maneuver", proposal.id),
        presentationTargetKind: "maneuver",
        presentationTargetSourceId: proposal.id,
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
      presentationTargetId: presentationTargetId("maneuver", proposal.id),
      presentationTargetKind: "maneuver",
      presentationTargetSourceId: proposal.id,
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
        presentationTargetId: presentationTargetId("maneuver", proposal.id),
        presentationTargetKind: "maneuver",
        presentationTargetSourceId: proposal.id,
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
        presentationTargetId: presentationTargetId("maneuver", proposal.id),
        presentationTargetKind: "maneuver",
        presentationTargetSourceId: proposal.id,
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
  if (
    nextDistance !== undefined &&
    previousDistance !== undefined &&
    nextDistance !== previousDistance
  ) {
    result.push(
      baseCandidate({
        ...common,
        category: "movement",
        detailResultId: proposal.id,
        eventId: `${input.event.id}:distance`,
        presentationTargetId: presentationTargetId("maneuver", proposal.id),
        presentationTargetKind: "maneuver",
        presentationTargetSourceId: proposal.id,
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
  if (!actor || !target || previousDistance === undefined || nextDistance === undefined)
    return undefined;
  return baseCandidate({
    actor,
    category: "movement",
    detailResultId: input.event.distanceProposalId,
    encounterId: input.encounterId,
    eventId: `${input.event.id}:distance`,
    occurredAt: input.event.occurredAt,
    phase: "round_end",
    presentationTargetId: presentationTargetId(
      "maneuver",
      input.event.distanceProposalId ?? input.event.id,
    ),
    presentationTargetKind: "maneuver",
    presentationTargetSourceId: input.event.distanceProposalId ?? input.event.id,
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
    const direction =
      proposal.direction === "closer"
        ? "move closer to"
        : proposal.direction === "farther"
          ? "move farther from"
          : "maintain distance from";
    attempts.push(
      baseCandidate({
        actor,
        category: "attempt",
        detailResultId: proposal.id,
        encounterId: input.encounterId,
        eventId: `${proposal.id}:attempt`,
        occurredAt: sourceEvent?.occurredAt ?? proposal.attackerRoll?.rolledAt,
        phase: "phase1",
        presentationTargetId: presentationTargetId("maneuver", proposal.id),
        presentationTargetKind: "maneuver",
        presentationTargetSourceId: proposal.id,
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
        presentationTargetId: presentationTargetId("maneuver", proposal.id),
        presentationTargetKind: "maneuver",
        presentationTargetSourceId: proposal.id,
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

const ITEM_ACTION_STATUS_PHRASES: Readonly<Record<CombatGenericActionStatus, string>> = {
  active: "in progress",
  cancelled: "cancelled",
  completed: "completed",
  declared: "waiting for GM review",
  interrupted: "interrupted",
  reviewed: "reviewed, waiting to act",
};

/**
 * Projects one canonical Item interaction declaration.
 *
 * The Combat Log is the player-facing status and history location for Item actions (Product Owner
 * ruling on Forgejo issue #409; Combat Panel Contract §12.4 routes the pending-status row here and
 * §12.8 forbids inventing another surface). The entry is derived from the **persisted**
 * `CombatGenericAction` alone, so:
 *
 * - it survives a reload, because nothing about it lives in component state, and
 * - the Log never owns an uncommitted draft (§12.3): an Item action exists here only once the
 *   declaration route has persisted it, and the panel's unsent form fields reach nothing.
 *
 * `state` carries pending-ness through the Log's own existing provisional/final vocabulary rather
 * than a new field, and the entry's audience is the Item interaction's own
 * `visibleToParticipantIds` — including the empty set, which correctly makes a GM-only Item action
 * reach no player at all.
 *
 * Only the **guarded Item-action family** is projected here — an action carrying a
 * `declarationKind` was minted by the combat-declaration surface and already has its own
 * declaration entry, so projecting it again would duplicate it (independent QA observation O1 on
 * Forgejo issue #409). `isCombatGuardedItemAction` is the same family discriminator the one-live
 * guard uses, so the Log and the guard always agree about what an Item action is.
 */
function projectItemActionDeclaration(input: {
  action: CombatGenericAction;
  encounterId: string;
  labels: ReadonlyMap<string, string>;
  roundNumber: number;
  sourceRevision: string;
}): Candidate | undefined {
  const interaction = input.action.itemInteraction;
  if (!isCombatGuardedItemAction(input.action) || !interaction) return undefined;
  const actor = subject(input.action.ownerParticipantId, input.labels);
  if (!actor) return undefined;
  const live = isCombatGenericActionLive(input.action);
  return baseCandidate({
    actor,
    audienceParticipantIds: interaction.visibleToParticipantIds,
    category: "declaration",
    encounterId: input.encounterId,
    eventId: `item-action:${input.action.id}:declared`,
    occurredAt: input.action.createdAt,
    phase: "declaration",
    roundNumber: input.roundNumber,
    semanticOrder: -1,
    sourceEventIds: [],
    sourceRevision: input.sourceRevision,
    sourceSequence: -1,
    state: live ? "provisional" : "final",
    summary: `${actor.displayName} declared ${input.action.intent} — ${
      ITEM_ACTION_STATUS_PHRASES[input.action.status]
    }.`,
    summaryFacts: {
      actionId: input.action.id,
      itemId: interaction.itemId,
      itemOperation: interaction.operation,
      kind: "item_action_declared",
      live,
      status: input.action.status,
    },
  });
}

/**
 * Projects every Item action across the timeline exactly once.
 *
 * A live Item action is carried forward unchanged into each following round's `genericActions`
 * (`advanceCombatGenericActionsToRound`), so the same action is visible in several round states.
 * The declaration belongs to the round it first appeared in, while its **status** is whatever the
 * newest round state says — so the entry stays put and its pending status keeps up.
 */
function itemActionDeclarations(input: {
  encounterId: string;
  sourceRevision: string;
  state: CombatRoundState;
}): Candidate[] {
  const firstRoundNumber = new Map<string, number>();
  const newest = new Map<
    string,
    { action: CombatGenericAction; labels: ReadonlyMap<string, string> }
  >();
  for (const roundState of getCombatRoundTimelineRoundStates(input.state)) {
    const labels = new Map(
      roundState.participants.map((participant) => [participant.participantId, participant.label]),
    );
    for (const action of roundState.genericActions) {
      if (!isCombatGuardedItemAction(action)) continue;
      if (!firstRoundNumber.has(action.id)) firstRoundNumber.set(action.id, roundState.roundNumber);
      newest.set(action.id, { action, labels });
    }
  }
  const candidates: Candidate[] = [];
  for (const [actionId, entry] of newest) {
    const candidate = projectItemActionDeclaration({
      action: entry.action,
      encounterId: input.encounterId,
      labels: entry.labels,
      roundNumber: firstRoundNumber.get(actionId) ?? entry.action.progress.startedRoundNumber ?? 1,
      sourceRevision: input.sourceRevision,
    });
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

/**
 * Projects one resolved Perform Task. The GM-authored player-safe text is the authorized Combat
 * outcome for its explicit audience; the entry carries that audience so no other viewer receives it.
 */
function projectTaskResolved(input: {
  encounterId: string;
  event: CombatStepEvent;
  labels: ReadonlyMap<string, string>;
  sourceRevision: string;
}): Candidate | undefined {
  const taskId = stringFact(input.event.facts.involvedOutcome, "taskId");
  const resultText = stringFact(input.event.facts.involvedOutcome, "resultText");
  if (!taskId || !resultText) return undefined;
  const actor = subject(
    input.event.actorParticipantId ?? input.event.ownerParticipantId,
    input.labels,
  );
  const rollOutcomeFact = stringFact(input.event.facts.involvedOutcome, "rollOutcome");
  const rollOutcome =
    rollOutcomeFact === "succeeded" || rollOutcomeFact === "failed" ? rollOutcomeFact : undefined;
  const audience = input.event.visibility.involvedParticipantIds;
  return baseCandidate({
    actor,
    audienceParticipantIds: audience.length > 0 ? audience : undefined,
    category: "state_change",
    encounterId: input.encounterId,
    eventId: `task:${taskId}:resolved`,
    occurredAt: input.event.occurredAt,
    phase: phaseForEvent(input.event),
    roundNumber: input.event.roundNumber,
    sourceEventIds: [input.event.id],
    sourceRevision: input.sourceRevision,
    sourceSequence: input.event.sequence,
    summary: actor
      ? `${possessive(actor.displayName)} task resolved: ${resultText}`
      : `Task resolved: ${resultText}`,
    summaryFacts: { kind: "task_resolved", rollOutcome, taskId },
  });
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
      } else if (event.type === "effect_review") {
        const treatment = projectCriticalBleedTreatment({
          encounterId: input.encounterId,
          event,
          labels,
          sourceRevision: input.sourceRevision,
        });
        if (treatment) candidates.push(treatment);
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
      } else if (event.type === "task_resolved") {
        const resolved = projectTaskResolved({
          encounterId: input.encounterId,
          event,
          labels,
          sourceRevision: input.sourceRevision,
        });
        if (resolved) candidates.push(resolved);
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

  candidates.push(
    ...itemActionDeclarations({
      encounterId: input.encounterId,
      sourceRevision: input.sourceRevision,
      state: input.state,
    }),
  );

  const uniqueCandidates = [
    ...new Map(candidates.map((candidate) => [candidate.id, candidate])).values(),
  ];
  const events = uniqueCandidates
    .sort(compareCandidates)
    .map(({ semanticOrder: _, sourceSequence: __, ...event }, sequence) => ({
      ...event,
      sequence,
    }));
  return deepFreeze({
    encounterId: input.encounterId,
    events,
    sourceRevision: input.sourceRevision,
  });
}
