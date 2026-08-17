import type { CombatStepEvent, CombatStepEventFacts } from "./combatStepEventSchema";
import { projectCombatResultEnvelope, type CombatResultEnvelope } from "./combatResultEnvelope";
import { deriveLegacyCombatStepEvents } from "./combatStepEvents";
import {
  buildCombatLogProjection,
  projectCombatLogForViewer,
  type CombatLogProjection,
} from "./combatLogProjection";
import type {
  CombatRoundParticipantState,
  CombatRoundStepSnapshot,
  CombatRoundState,
  CompletedCombatRound,
} from "./combatRoundManager";
import {
  materializeCombatHistoryRoundState,
  type CombatHistorySourceView,
} from "./combatReadModels";
import {
  buildCombatProgressionProjection,
  projectCombatProgressionPresentation,
  type CombatProgressionPresentationProjection,
  type CombatProgressionProjection,
} from "./combatProgressionProjection";
import {
  buildPlayerSafeCombatObservationRelationships,
  type CombatObservationRelationship,
} from "./combatObservation";
import {
  canonicalCombatModifierEffectSchema,
  projectPlayerSafeCanonicalCombatModifierEffect,
  type CanonicalCombatModifierEffect,
  type PlayerSafeCanonicalCombatModifierEffect,
} from "./combatModifierLifecycle";

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
  opportunityId?: string;
  ownerParticipantId?: string;
  phase?: CombatStepEvent["phase"];
  /** Always present for repository projections; optional only for bounded legacy/client fixtures. */
  resultEnvelope?: CombatResultEnvelope;
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
      secondaryActionTargetParticipantId?: string;
    };
    modifiers: ProjectedCombatHistoryModifierSummary | Record<string, never>;
    phase1: ProjectedCombatHistoryPhasePanel;
    phase2: ProjectedCombatHistoryPhasePanel;
  };
  participant: ProjectedCombatHistoryRow;
  phase?: CombatStepEvent["phase"];
  roundNumber: number;
  step: CombatStepEvent["step"];
  stepOutcome?: CombatHistoryStepOutcome;
}

export type ProjectedCombatHistoryModifierSummary = Omit<
  NonNullable<CombatRoundStepSnapshot["modifierSummary"]>,
  "effects"
> & {
  effects?: Array<
    | NonNullable<NonNullable<CombatRoundStepSnapshot["modifierSummary"]>["effects"]>[number]
    | PlayerSafeCanonicalCombatModifierEffect
  >;
};

export type CombatHistoryStepOutcomeReason =
  | "action_explicitly_skipped"
  | "damage_not_required"
  | "double_attack_cancelled"
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
  attackModeLabel?: string;
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
  observationRelationships: CombatObservationRelationship[];
  roundNumber: number;
  snapshots: ProjectedCombatHistorySnapshot[];
}

export interface CombatHistoryProjection {
  activeRound: ProjectedCombatHistoryRound;
  archivedRounds: ProjectedCombatHistoryRound[];
  /** Fiction-facing event stream projected for this viewer. */
  combatLog?: CombatLogProjection;
  /** Player-safe canonical modifier totals bound to the currently executable attack task. */
  currentAttackModifierValidation?: CombatAttackModifierValidationProjection;
  /** Player-safe canonical modifier totals bound to the currently executable parry task. */
  currentParryModifierValidation?: CombatParryModifierValidationProjection;
  /** Sanitized canonical live progression for the same encounter revision. */
  progression?: CombatProgressionPresentationProjection;
  rows: ProjectedCombatHistoryRow[];
  /** Encounter identity used to build this projection. */
  sourceEncounterId?: string;
  /** Encounter revision used to build this projection. */
  sourceUpdatedAt?: string;
}

export interface CombatAttackModifierValidationProjection {
  actionId: string;
  /** Whether every canonical, player-safe input required by the current attack is available. */
  attackContextAvailability: "complete" | "unavailable_required";
  attackerModifierFingerprint: string;
  attackerParticipantId: string;
  defenderParticipantId: string;
  disarmAttemptId?: string;
  /** The current initiative group is also the effect cutoff for this attack calculation. */
  effectCutoffInitiativeGroupId?: string;
  encounterId: string;
  expectedRevision: string;
  initiativeGroupId?: string;
  initiativeValue?: number;
  obSkillRaw: number;
  opportunityId?: string;
  pairKey: string;
  phase: "phase1" | "phase2";
  proposalId?: string;
  taskId: string;
}

export interface CombatParryModifierValidationProjection {
  attackResultId: string;
  attackResultModifier: number;
  attackerParticipantId: string;
  dbParryRaw: number;
  defenderModifierFingerprint: string;
  defenderParticipantId: string;
  disarmAttemptId?: string;
  /** The current initiative group is also the effect cutoff for this parry calculation. */
  effectCutoffInitiativeGroupId?: string;
  encounterId: string;
  expectedRevision: string;
  initiativeGroupId?: string;
  initiativeValue?: number;
  opportunityId: string;
  parryPurpose: "ordinary_defense" | "offensive_parry" | "parry_disarm";
  parrySourceId: string;
  processId: string;
  stageId: string;
  taskId: string;
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

  if (snapshot.actionResultReason === "double_attack_cancelled") {
    return {
      category: "skipped",
      message: "Attack 2 was cancelled after Attack 1.",
      reason: "double_attack_cancelled",
    };
  }

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

  // Declaration completion is a safe progression fact for every visible
  // participant.  It must survive player sanitization so the DE tracker cell
  // can distinguish submitted work from an ordinary pending declaration.
  // The declaration's private details remain protected by the field-level
  // projection below.
  if (
    input.event.type === "declaration" &&
    input.event.ownerParticipantId &&
    input.viewer.visibleParticipantIds.has(input.event.ownerParticipantId)
  ) {
    return true;
  }

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
  const identities = projectEventIdentities({
    event: input.event,
    labels,
    viewer: input.viewer,
  }).filter(
    (identity) =>
      input.event.type !== "declaration" ||
      gm ||
      involved ||
      (identity.role !== "target" && identity.role !== "defender"),
  );

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
    identities,
    missingFacts: input.event.missingFacts,
    occurredAt: input.event.occurredAt,
    opportunityId: input.event.opportunityId,
    ownerParticipantId:
      input.event.ownerParticipantId &&
      isVisible({ participantId: input.event.ownerParticipantId, viewer: input.viewer })
        ? input.event.ownerParticipantId
        : undefined,
    phase: input.event.phase,
    resultEnvelope: projectCombatResultEnvelope({
      event: input.event,
      identities,
      involved,
      ownRoll,
      viewer: gm ? "gm" : "player",
    }),
    roundNumber: input.event.roundNumber,
    sequence: input.event.sequence,
    status: input.event.status,
    step: input.event.step,
    type: input.event.type,
  };
}

function projectSnapshot(input: {
  declarationEvents: readonly CombatStepEvent[];
  labels: ReadonlyMap<string, string>;
  roundParticipants: readonly CombatRoundParticipantState[];
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
  const modifierSummary = input.snapshot.modifierSummary;
  let projectedModifierEffects: ProjectedCombatHistoryModifierSummary["effects"];
  let projectedModifierRows = modifierSummary?.rows;
  if (input.viewer.kind === "gm") {
    projectedModifierEffects = modifierSummary?.effects;
  } else {
    const playerViewer = input.viewer;
    const projectModifierEffect = (effect: CanonicalCombatModifierEffect) =>
      projectPlayerSafeCanonicalCombatModifierEffect({
        effect,
        viewer: {
          controlledParticipantIds: playerViewer.controlledParticipantIds,
          isGm: false,
          visibleParticipantIds: playerViewer.visibleParticipantIds,
        },
      });
    projectedModifierEffects = modifierSummary?.effects?.flatMap((effect) => {
      const projected = projectModifierEffect(effect);
      return projected ? [projected] : [];
    });
    projectedModifierRows = modifierSummary?.rows.map((row) => ({
      ...row,
      entries: row.entries.map((entry) => {
        const effect = canonicalCombatModifierEffectSchema.safeParse(entry.canonicalLifecycle);
        return effect.success
          ? {
              ...entry,
              canonicalLifecycle: undefined,
            }
          : entry;
      }),
    }));
  }
  const projectedModifierSummary: ProjectedCombatHistoryModifierSummary | undefined =
    ownsSnapshot && modifierSummary
      ? {
          ...modifierSummary,
          effects: projectedModifierEffects,
          rows: projectedModifierRows ?? modifierSummary.rows,
        }
      : undefined;
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
      attackModeLabel: ownsSnapshot ? panel.attackModeLabel : undefined,
      attackSummary: ownsSnapshot ? panel.attackSummary : undefined,
      defenseSummary: ownsSnapshot ? panel.defenseSummary : undefined,
      distanceLabel: panel.distanceLabel,
      mainHandParryItemLabel: ownsSnapshot ? panel.mainHandParryItemLabel : undefined,
      offHandParryItemLabel: ownsSnapshot ? panel.offHandParryItemLabel : undefined,
      phaseContext: ownsSnapshot
        ? {
            incomingAttackSide: panel.phaseContext.incomingAttackSide,
            attackModeId: panel.phaseContext.attackModeId,
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
  const declarationEvent = input.declarationEvents.find(
    (event) =>
      event.type === "declaration" &&
      event.ownerParticipantId === input.snapshot.participantId &&
      event.step === "select_actions",
  );
  const declarationOutcome = declarationEvent?.facts.involvedOutcome;
  const archivedDeclaration = input.roundParticipants.find(
    (participant) => participant.participantId === input.snapshot.participantId,
  )?.declaration;
  const declarationSummary =
    input.snapshot.declarationSummary ??
    (declarationOutcome && typeof declarationOutcome.actionId === "string"
      ? {
          actionId: declarationOutcome.actionId,
          additionalActionNotes: archivedDeclaration?.additionalActionNotes,
          movementId:
            typeof declarationOutcome.movementId === "string"
              ? declarationOutcome.movementId
              : archivedDeclaration?.movementId,
          movementIntent: archivedDeclaration?.movementIntent,
          movementPreferenceTargets: input.roundParticipants
            .filter((participant) => participant.participantId !== input.snapshot.participantId)
            .map((participant) => ({
              displayName: participant.label,
              id: participant.participantId,
            })),
          secondaryActionContext: archivedDeclaration?.secondaryActionContext,
          secondaryActionId:
            typeof declarationOutcome.secondaryActionId === "string"
              ? declarationOutcome.secondaryActionId
              : archivedDeclaration?.secondaryActionId,
        }
      : undefined);

  return {
    completeness: incomplete ? "incomplete" : "complete",
    id: input.snapshot.id,
    incompleteMessage: incomplete
      ? "Complete historical result details are unavailable."
      : undefined,
    panels: {
      actionResult: {
        attackResult: safeAttackResult,
        initiativeResult:
          ownsSnapshot &&
          (input.snapshot.step === "initiative_phase_1" ||
            input.snapshot.step === "initiative_phase_2")
            ? input.snapshot.initiativeResult
            : undefined,
        status: input.snapshot.actionResultStatus,
      },
      actionSelector: ownsSnapshot
        ? {
            actionId: declarationSummary?.actionId,
            actionLabel: declarationSummary?.actionLabel,
            additionalActionNotes: declarationSummary?.additionalActionNotes,
            movementId: declarationSummary?.movementId,
            movementIntent: declarationSummary?.movementIntent
              ? {
                  ...declarationSummary.movementIntent,
                  distancePreferences: declarationSummary.movementIntent.distancePreferences.filter(
                    (preference) =>
                      isVisible({
                        participantId: preference.targetParticipantId,
                        viewer: input.viewer,
                      }),
                  ),
                }
              : undefined,
            movementLabel: declarationSummary?.movementLabel,
            movementPreferenceTargets: targetOptions(declarationSummary?.movementPreferenceTargets),
            secondaryActionId: declarationSummary?.secondaryActionId,
            secondaryActionLabel: declarationSummary?.secondaryActionLabel,
            secondaryActionTargetParticipantId:
              declarationSummary?.secondaryActionContext?.targetParticipantId &&
              isVisible({
                participantId: declarationSummary.secondaryActionContext.targetParticipantId,
                viewer: input.viewer,
              })
                ? declarationSummary.secondaryActionContext.targetParticipantId
                : undefined,
          }
        : {},
      modifiers: projectedModifierSummary ?? {},
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
  observationRelationships: readonly CombatObservationRelationship[];
  participants: readonly CombatHistoryParticipantInput[];
  roundParticipants: readonly CombatRoundParticipantState[];
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
    observationRelationships:
      input.viewer.kind === "gm"
        ? [...input.observationRelationships]
        : buildPlayerSafeCombatObservationRelationships({
            controlledParticipantIds: input.viewer.controlledParticipantIds,
            relationships: input.observationRelationships,
          }),
    roundNumber: input.roundNumber,
    snapshots: input.snapshots
      .map((snapshot) =>
        projectSnapshot({
          declarationEvents: input.events,
          labels: input.labels,
          roundParticipants: input.roundParticipants,
          snapshot,
          viewer: input.viewer,
        }),
      )
      .filter((snapshot): snapshot is ProjectedCombatHistorySnapshot => Boolean(snapshot)),
  };
}

const RESULT_COMPLETENESS_DERIVED_EVENT_TYPES = new Set<CombatStepEvent["type"]>([
  "action_skipped",
  "combat_experience",
  "declaration",
  "effect_review",
  "initiative",
  "modifier_review",
  "round_boundary",
]);

export function getCombatRoundEventsWithDerivedResultCoverage(input: {
  commands: CompletedCombatRound["commands"] | CombatRoundState["commands"];
  encounterId: string;
  events: readonly CombatStepEvent[];
  participants: CompletedCombatRound["participants"] | CombatRoundState["participants"];
  phaseResolutionResults:
    | CompletedCombatRound["phaseResolutionResults"]
    | CombatRoundState["phaseResolutionResults"];
  roundEndReview: CompletedCombatRound["roundEndReview"] | CombatRoundState["roundEndReview"];
  roundNumber: number;
  stepSnapshots: CompletedCombatRound["stepSnapshots"] | CombatRoundState["stepSnapshots"];
}): CombatStepEvent[] {
  const existingCommandIds = new Set(
    input.events.flatMap((event) => (event.commandId ? [event.commandId] : [])),
  );
  const existingEventIds = new Set(input.events.map((event) => event.id));
  const derived = deriveLegacyCombatStepEvents({
    commands: input.commands,
    encounterId: input.encounterId,
    participants: input.participants,
    phaseResolutionResults: input.phaseResolutionResults,
    roundEndReview: input.roundEndReview,
    roundNumber: input.roundNumber,
    stepSnapshots: input.stepSnapshots,
  }).filter(
    (event) =>
      RESULT_COMPLETENESS_DERIVED_EVENT_TYPES.has(event.type) &&
      !existingEventIds.has(event.id) &&
      (!event.commandId || !existingCommandIds.has(event.commandId)),
  );
  return [...input.events, ...derived].sort(
    (left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id),
  );
}

export function projectCombatHistory(input: {
  currentAttackModifierValidation?: CombatAttackModifierValidationProjection;
  currentParryModifierValidation?: CombatParryModifierValidationProjection;
  participants: readonly CombatHistoryParticipantInput[];
  progressionProjection?: CombatProgressionProjection;
  source: CombatHistorySourceView;
  viewer: CombatHistoryViewer;
}): CombatHistoryProjection {
  const state = materializeCombatHistoryRoundState(input.source);
  if (!state) {
    throw new Error("Combat history projection requires an active combat state.");
  }
  const progression = projectCombatProgressionPresentation({
    projection: input.progressionProjection ?? buildCombatProgressionProjection(state),
    viewer: input.viewer,
  });
  const visibleParticipants = input.participants.filter((participant) =>
    isVisible({ participantId: participant.participantId, viewer: input.viewer }),
  );
  const labels = new Map(
    visibleParticipants.map((participant) => [participant.participantId, participant.displayName]),
  );
  const archivedRounds = state.rounds.map((round: CompletedCombatRound) =>
    projectRound({
      events: getCombatRoundEventsWithDerivedResultCoverage({
        commands: round.commands,
        encounterId: round.encounterId ?? state.encounterId ?? "combat-history",
        events: round.events,
        participants: round.participants,
        phaseResolutionResults: round.phaseResolutionResults,
        roundEndReview: round.roundEndReview,
        roundNumber: round.roundNumber,
        stepSnapshots: round.stepSnapshots,
      }),
      labels,
      observationRelationships: round.observationRelationships,
      participants: visibleParticipants,
      roundParticipants: round.participants,
      roundNumber: round.roundNumber,
      snapshots: round.stepSnapshots,
      viewer: input.viewer,
    }),
  );

  return {
    activeRound: projectRound({
      events: getCombatRoundEventsWithDerivedResultCoverage({
        commands: state.commands,
        encounterId: state.encounterId ?? "combat-history",
        events: state.events,
        participants: state.participants,
        phaseResolutionResults: state.phaseResolutionResults,
        roundEndReview: state.roundEndReview,
        roundNumber: state.roundNumber,
        stepSnapshots: state.stepSnapshots,
      }),
      labels,
      observationRelationships: state.observationRelationships,
      participants: visibleParticipants,
      roundParticipants: state.participants,
      roundNumber: state.roundNumber,
      snapshots: state.stepSnapshots,
      viewer: input.viewer,
    }),
    archivedRounds,
    ...(state.encounterId
      ? {
          combatLog: projectCombatLogForViewer({
            projection: buildCombatLogProjection({
              encounterId: state.encounterId,
              sourceRevision: input.source.revision,
              state,
            }),
            unpublishedDeclarationRoundNumber:
              progression.boundary.kind === "declaration" ? state.roundNumber : undefined,
            viewer: input.viewer,
          }),
        }
      : {}),
    currentAttackModifierValidation: input.currentAttackModifierValidation,
    currentParryModifierValidation: input.currentParryModifierValidation,
    progression,
    rows: visibleParticipants.map((participant) => ({
      displayName: participant.displayName,
      participantId: participant.participantId,
    })),
    sourceEncounterId: input.source.encounterId,
    sourceUpdatedAt: input.source.revision,
  };
}
