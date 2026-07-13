import type { CombatStepEvent, CombatStepEventFacts } from "./combatStepEventSchema";
import type {
  CombatRoundStepSnapshot,
  CombatRoundState,
  CompletedCombatRound,
} from "./combatRoundManager";

export type CombatHistoryViewer =
  | { kind: "gm" }
  | {
      controlledParticipantIds: ReadonlySet<string>;
      kind: "player";
      visibleParticipantIds: ReadonlySet<string>;
    };

export interface CombatHistoryParticipantIdentity {
  displayName: string;
  participantId?: string;
  role: CombatStepEvent["visibility"]["identityRefs"][number]["role"] | "owner";
  visibility: "visible" | "unseen";
}

export interface ProjectedCombatHistoryEvent {
  completeness: CombatStepEvent["completeness"];
  facts: {
    gmReview?: CombatStepEventFacts["gmReview"];
    involvedOutcome?: CombatStepEventFacts["involvedOutcome"];
    privateCalculation?: CombatStepEventFacts["rollerPrivate"];
    publicOutcome: CombatStepEventFacts["publicOutcome"];
  };
  id: string;
  identities: CombatHistoryParticipantIdentity[];
  missingFacts: string[];
  occurredAt: string | null;
  ownerParticipantId?: string;
  phase?: CombatStepEvent["phase"];
  roundNumber: number;
  sequence: number;
  status: CombatStepEvent["status"];
  step: CombatStepEvent["step"];
  type: CombatStepEvent["type"];
}

export interface ProjectedCombatHistoryRow {
  displayName: string;
  participantId: string;
}

export interface ProjectedCombatHistorySnapshot {
  completeness: "complete" | "incomplete";
  id: string;
  incompleteMessage?: string;
  panels: {
    actionResult: {
      attackResult?: Record<string, unknown>;
      initiativeResult?: CombatRoundStepSnapshot["initiativeResult"];
      status?: CombatRoundStepSnapshot["actionResultStatus"];
    };
    actionSelector: {
      actionId?: string;
      actionLabel?: string;
      additionalActionNotes?: string;
      movementId?: string;
      movementIntent?: NonNullable<CombatRoundStepSnapshot["declarationSummary"]>["movementIntent"];
      movementLabel?: string;
      movementPreferenceTargets?: Array<{ displayName: string; participantId: string }>;
      secondaryActionId?: string;
      secondaryActionLabel?: string;
    };
    modifiers: NonNullable<CombatRoundStepSnapshot["modifierSummary"]> | Record<string, never>;
    phase1: ProjectedCombatHistoryPhasePanel;
    phase2: ProjectedCombatHistoryPhasePanel;
  };
  participant: ProjectedCombatHistoryRow;
  phase?: CombatStepEvent["phase"];
  roundNumber: number;
  step: CombatStepEvent["step"];
  stepOutcome?: CombatHistoryStepOutcome;
}

export type CombatHistoryStepOutcomeReason =
  | "action_explicitly_skipped"
  | "damage_not_required"
  | "incoming_attack_missed"
  | "no_declared_attack"
  | "no_incoming_attack"
  | "parry_not_required";

export interface CombatHistoryStepOutcome {
  category: "not_applicable" | "not_required" | "skipped";
  message: string;
  reason: CombatHistoryStepOutcomeReason;
}

export interface ProjectedCombatHistoryPhasePanel {
  attackSummary?: CombatRoundStepSnapshot["attackSummary"];
  defenseSummary?: CombatRoundStepSnapshot["defenseSummary"];
  distanceLabel?: string;
  mainHandParryItemLabel?: string;
  offHandParryItemLabel?: string;
  phaseContext?: CombatRoundStepSnapshot["phaseContext"];
  targetOptions?: Array<{ displayName: string; participantId: string }>;
}

// Player history intentionally omits canonical initiative ranks. Filtering hidden
// participants would otherwise expose rank gaps; the future tracker may derive a
// visible-only display rank without changing the stored combat result.

export interface ProjectedCombatHistoryRound {
  events: ProjectedCombatHistoryEvent[];
  roundNumber: number;
  snapshots: ProjectedCombatHistorySnapshot[];
}

export interface CombatHistoryProjection {
  activeRound: ProjectedCombatHistoryRound;
  archivedRounds: ProjectedCombatHistoryRound[];
  rows: ProjectedCombatHistoryRow[];
}

export interface CombatHistoryParticipantInput {
  displayName: string;
  participantId: string;
}

/**
 * Explains why an immutable historical cell has no roll/result. This is derived
 * only from recorded snapshot facts and never from the live combat cursor.
 */
export function deriveCombatHistoryStepOutcome(
  snapshot: CombatRoundStepSnapshot | undefined,
): CombatHistoryStepOutcome | undefined {
  if (!snapshot) return undefined;

  const parryStep =
    snapshot.step === "review_phase_2_actions" || snapshot.step === "review_phase_2_damage";
  const damageStep = snapshot.step === "phase_1_damage" || snapshot.step === "phase_2_damage";
  const attackStep = snapshot.step === "phase_1_actions" || snapshot.step === "phase_2_actions";
  const resolution = snapshot.phaseResolutionResult;

  if (parryStep && resolution?.parryResolution.status === "not_applicable") {
    if (snapshot.attackResult && !snapshot.attackResult.hit && !snapshot.attackResult.grazing) {
      return {
        category: "not_required",
        message: "No parry required. The incoming attack missed.",
        reason: "incoming_attack_missed",
      };
    }
    return {
      category: "not_required",
      message: "No parry required.",
      reason: "parry_not_required",
    };
  }

  if (damageStep && resolution?.damageRoll.status === "not_required") {
    return {
      category: "not_required",
      message:
        snapshot.attackResult && !snapshot.attackResult.hit && !snapshot.attackResult.grazing
          ? "No damage resolution required. No hit was recorded."
          : "No damage resolution required.",
      reason: "damage_not_required",
    };
  }

  if (attackStep && snapshot.actionResultStatus === "no_attack") {
    return {
      category: "not_applicable",
      message: `Not applicable. No ${snapshot.phase === "phase2" ? "phase-2" : "phase-1"} attack was declared.`,
      reason: "no_declared_attack",
    };
  }

  if (parryStep && snapshot.actionResultStatus === "no_attack") {
    return {
      category: "not_applicable",
      message: "Not applicable. No incoming attack was recorded.",
      reason: "no_incoming_attack",
    };
  }

  if (snapshot.actionResultStatus === "skipped") {
    return {
      category: "skipped",
      message: "Skipped. The eligible action was explicitly skipped.",
      reason: "action_explicitly_skipped",
    };
  }

  return undefined;
}

function hasFacts(facts: Record<string, unknown>): boolean {
  return Object.keys(facts).length > 0;
}

function isVisible(input: { participantId: string; viewer: CombatHistoryViewer }): boolean {
  return input.viewer.kind === "gm" || input.viewer.visibleParticipantIds.has(input.participantId);
}

function isControlled(input: { participantId?: string; viewer: CombatHistoryViewer }): boolean {
  return Boolean(
    input.participantId &&
    input.viewer.kind === "player" &&
    input.viewer.controlledParticipantIds.has(input.participantId),
  );
}

function getIdentityFallback(
  fallback: CombatStepEvent["visibility"]["identityRefs"][number]["hiddenIdentityFallback"],
): string | undefined {
  if (fallback === "unseen_attacker") return "an unseen attacker";
  if (fallback === "unseen_target") return "an unseen target";
  return undefined;
}

function projectEventIdentities(input: {
  event: CombatStepEvent;
  labels: ReadonlyMap<string, string>;
  viewer: CombatHistoryViewer;
}): CombatHistoryParticipantIdentity[] {
  return input.event.visibility.identityRefs.reduce<CombatHistoryParticipantIdentity[]>(
    (result, ref) => {
      if (isVisible({ participantId: ref.participantId, viewer: input.viewer })) {
        const displayName = input.labels.get(ref.participantId);
        if (displayName) {
          result.push({
            displayName,
            participantId: ref.participantId,
            role: ref.role,
            visibility: "visible",
          });
        }
        return result;
      }

      const displayName = getIdentityFallback(ref.hiddenIdentityFallback);
      if (displayName) {
        result.push({ displayName, role: ref.role, visibility: "unseen" });
      }
      return result;
    },
    [],
  );
}

function shouldProjectPlayerEvent(input: {
  event: CombatStepEvent;
  viewer: Extract<CombatHistoryViewer, { kind: "player" }>;
}): boolean {
  if (input.event.type === "damage_proposed") return false;

  const involved = input.event.visibility.involvedParticipantIds.some((participantId) =>
    input.viewer.controlledParticipantIds.has(participantId),
  );
  const ownRoll = isControlled({
    participantId: input.event.rollerParticipantId,
    viewer: input.viewer,
  });

  if (involved || ownRoll) {
    if (
      input.event.type.startsWith("distance_control_") &&
      input.event.visibility.involvedParticipantIds.some(
        (participantId) => !input.viewer.visibleParticipantIds.has(participantId),
      )
    ) {
      return false;
    }
    return true;
  }

  const publicScope =
    input.event.visibility.outcomeScope === "public" ||
    input.event.visibility.outcomeScope === "perceived";
  return (
    publicScope &&
    input.event.visibility.identityRefs.every((ref) =>
      input.viewer.visibleParticipantIds.has(ref.participantId),
    )
  );
}

export function projectCombatHistoryEvent(input: {
  event: CombatStepEvent;
  participants: readonly CombatHistoryParticipantInput[];
  viewer: CombatHistoryViewer;
}): ProjectedCombatHistoryEvent | undefined {
  if (
    input.viewer.kind === "player" &&
    !shouldProjectPlayerEvent({ event: input.event, viewer: input.viewer })
  ) {
    return undefined;
  }

  const labels = new Map(
    input.participants.map((participant) => [participant.participantId, participant.displayName]),
  );
  const gm = input.viewer.kind === "gm";
  const involved =
    gm ||
    input.event.visibility.involvedParticipantIds.some((participantId) =>
      isControlled({ participantId, viewer: input.viewer }),
    );
  const ownRoll =
    gm || isControlled({ participantId: input.event.rollerParticipantId, viewer: input.viewer });

  return {
    completeness: input.event.completeness,
    facts: {
      gmReview: gm && hasFacts(input.event.facts.gmReview) ? input.event.facts.gmReview : undefined,
      involvedOutcome:
        involved && hasFacts(input.event.facts.involvedOutcome)
          ? input.event.facts.involvedOutcome
          : undefined,
      privateCalculation:
        ownRoll && hasFacts(input.event.facts.rollerPrivate)
          ? input.event.facts.rollerPrivate
          : undefined,
      publicOutcome: input.event.facts.publicOutcome,
    },
    id: input.event.id,
    identities: projectEventIdentities({ event: input.event, labels, viewer: input.viewer }),
    missingFacts: input.event.missingFacts,
    occurredAt: input.event.occurredAt,
    ownerParticipantId:
      input.event.ownerParticipantId &&
      isVisible({ participantId: input.event.ownerParticipantId, viewer: input.viewer })
        ? input.event.ownerParticipantId
        : undefined,
    phase: input.event.phase,
    roundNumber: input.event.roundNumber,
    sequence: input.event.sequence,
    status: input.event.status,
    step: input.event.step,
    type: input.event.type,
  };
}

function projectSnapshot(input: {
  labels: ReadonlyMap<string, string>;
  snapshot: CombatRoundStepSnapshot;
  viewer: CombatHistoryViewer;
}): ProjectedCombatHistorySnapshot | undefined {
  if (!isVisible({ participantId: input.snapshot.participantId, viewer: input.viewer }))
    return undefined;
  const displayName = input.labels.get(input.snapshot.participantId);
  if (!displayName) return undefined;

  const ownsSnapshot =
    input.viewer.kind === "gm" ||
    input.viewer.controlledParticipantIds.has(input.snapshot.participantId);
  const targetOptions = (options: Array<{ displayName: string; id: string }> = []) =>
    options.flatMap((target) => {
      if (!isVisible({ participantId: target.id, viewer: input.viewer })) return [];
      const safeName = input.labels.get(target.id);
      return safeName ? [{ displayName: safeName, participantId: target.id }] : [];
    });
  const phasePanel = (phase: "phase1" | "phase2") => {
    const panel = input.snapshot.phasePanels?.[phase];
    if (!panel) return {};
    return {
      attackSummary: ownsSnapshot ? panel.attackSummary : undefined,
      defenseSummary: ownsSnapshot ? panel.defenseSummary : undefined,
      distanceLabel: panel.distanceLabel,
      mainHandParryItemLabel: ownsSnapshot ? panel.mainHandParryItemLabel : undefined,
      offHandParryItemLabel: ownsSnapshot ? panel.offHandParryItemLabel : undefined,
      phaseContext: ownsSnapshot
        ? {
            incomingAttackSide: panel.phaseContext.incomingAttackSide,
            mainHandParryDirection: panel.phaseContext.mainHandParryDirection,
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            offHandParryDirection: panel.phaseContext.offHandParryDirection,
            parrySource: panel.phaseContext.parrySource,
            selectedOpponentId:
              panel.phaseContext.selectedOpponentId &&
              isVisible({
                participantId: panel.phaseContext.selectedOpponentId,
                viewer: input.viewer,
              })
                ? panel.phaseContext.selectedOpponentId
                : undefined,
            targetLocation: panel.phaseContext.targetLocation,
            targetParticipantId:
              panel.phaseContext.targetParticipantId &&
              isVisible({
                participantId: panel.phaseContext.targetParticipantId,
                viewer: input.viewer,
              })
                ? panel.phaseContext.targetParticipantId
                : undefined,
          }
        : undefined,
      targetOptions: targetOptions(panel.targetOptions),
    };
  };
  const incomplete =
    input.snapshot.actionResultStatus === "no_result" ||
    input.snapshot.actionResultStatus === undefined;
  const safeAttackResult =
    ownsSnapshot &&
    input.snapshot.attackResult &&
    isVisible({
      participantId: input.snapshot.attackResult.attackerParticipantId,
      viewer: input.viewer,
    }) &&
    isVisible({
      participantId: input.snapshot.attackResult.defenderParticipantId,
      viewer: input.viewer,
    })
      ? {
          ...input.snapshot.attackResult,
          rolledByUserId: undefined,
        }
      : undefined;

  return {
    completeness: incomplete ? "incomplete" : "complete",
    id: input.snapshot.id,
    incompleteMessage: incomplete
      ? "Complete historical result details are unavailable."
      : undefined,
    panels: {
      actionResult: {
        attackResult: safeAttackResult,
        initiativeResult: ownsSnapshot ? input.snapshot.initiativeResult : undefined,
        status: input.snapshot.actionResultStatus,
      },
      actionSelector: ownsSnapshot
        ? {
            actionId: input.snapshot.declarationSummary?.actionId,
            actionLabel: input.snapshot.declarationSummary?.actionLabel,
            additionalActionNotes: input.snapshot.declarationSummary?.additionalActionNotes,
            movementId: input.snapshot.declarationSummary?.movementId,
            movementIntent: input.snapshot.declarationSummary?.movementIntent
              ? {
                  ...input.snapshot.declarationSummary.movementIntent,
                  distancePreferences:
                    input.snapshot.declarationSummary.movementIntent.distancePreferences.filter(
                      (preference) =>
                        isVisible({
                          participantId: preference.targetParticipantId,
                          viewer: input.viewer,
                        }),
                    ),
                }
              : undefined,
            movementLabel: input.snapshot.declarationSummary?.movementLabel,
            movementPreferenceTargets: targetOptions(
              input.snapshot.declarationSummary?.movementPreferenceTargets,
            ),
            secondaryActionId: input.snapshot.declarationSummary?.secondaryActionId,
            secondaryActionLabel: input.snapshot.declarationSummary?.secondaryActionLabel,
          }
        : {},
      modifiers: ownsSnapshot ? (input.snapshot.modifierSummary ?? {}) : {},
      phase1: phasePanel("phase1"),
      phase2: phasePanel("phase2"),
    },
    participant: { displayName, participantId: input.snapshot.participantId },
    phase: input.snapshot.phase,
    roundNumber: input.snapshot.roundNumber,
    step: input.snapshot.step,
    stepOutcome: deriveCombatHistoryStepOutcome(input.snapshot),
  };
}

function projectRound(input: {
  events: readonly CombatStepEvent[];
  labels: ReadonlyMap<string, string>;
  participants: readonly CombatHistoryParticipantInput[];
  roundNumber: number;
  snapshots: readonly CombatRoundStepSnapshot[];
  viewer: CombatHistoryViewer;
}): ProjectedCombatHistoryRound {
  return {
    events: input.events
      .map((event) =>
        projectCombatHistoryEvent({
          event,
          participants: input.participants,
          viewer: input.viewer,
        }),
      )
      .filter((event): event is ProjectedCombatHistoryEvent => Boolean(event)),
    roundNumber: input.roundNumber,
    snapshots: input.snapshots
      .map((snapshot) => projectSnapshot({ labels: input.labels, snapshot, viewer: input.viewer }))
      .filter((snapshot): snapshot is ProjectedCombatHistorySnapshot => Boolean(snapshot)),
  };
}

export function projectCombatHistory(input: {
  participants: readonly CombatHistoryParticipantInput[];
  state: CombatRoundState;
  viewer: CombatHistoryViewer;
}): CombatHistoryProjection {
  const visibleParticipants = input.participants.filter((participant) =>
    isVisible({ participantId: participant.participantId, viewer: input.viewer }),
  );
  const labels = new Map(
    visibleParticipants.map((participant) => [participant.participantId, participant.displayName]),
  );
  const archivedRounds = input.state.rounds.map((round: CompletedCombatRound) =>
    projectRound({
      events: round.events,
      labels,
      participants: visibleParticipants,
      roundNumber: round.roundNumber,
      snapshots: round.stepSnapshots,
      viewer: input.viewer,
    }),
  );

  return {
    activeRound: projectRound({
      events: input.state.events,
      labels,
      participants: visibleParticipants,
      roundNumber: input.state.roundNumber,
      snapshots: input.state.stepSnapshots,
      viewer: input.viewer,
    }),
    archivedRounds,
    rows: visibleParticipants.map((participant) => ({
      displayName: participant.displayName,
      participantId: participant.participantId,
    })),
  };
}
