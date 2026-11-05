import { getCombatDeclarationActionLabel } from "./combatDeclarationValidation";
import { getMovementIntentLabel } from "./combatMovementIntent";
import {
  buildCombatModifierRowProjection,
  getCombatModifierRowPhaseKeyForStep,
  type CombatModifierRowPhaseKey,
} from "./combatModifierRowProjection";
import { canonicalCombatModifierEffectSchema } from "./combatModifierLifecycle";
import {
  buildCombatRoundPhaseResolutionResult,
  combatRoundStateSchema,
  getCombatRoundDisplayIncomingAttackResultForParticipantPhase,
  getCombatRoundInitiativeRanks,
  getCombatRoundModifierPhaseForStep,
  getCombatRoundOutgoingAttackResultForParticipantPhase,
  getCombatRoundPhaseResolutionResultForAttack,
  getCombatRoundPhaseResolutionStatus,
  upsertCombatRoundStepSnapshots,
  type CombatRoundParticipantState,
  type CombatRoundPhase,
  type CombatRoundState,
  type CombatRoundStepSnapshot,
} from "./combatRoundManager";
import { COMBAT_ROUND_STEPS, type CombatRoundStep } from "./combatRoundStep";
import type { CombatEffectsState } from "./combatEffects";
import type {
  ScenarioParticipantCombatContext,
  ScenarioCombatModifierEntry,
} from "../campaign/scenario";

/**
 * #951 / #889 — the server derives and persists each committed step's authoritative snapshot.
 *
 * Product Owner ruling of 2026-11-06: "When a Combat step is committed, the server derives and
 * persists that step's authoritative snapshot from the state it is committing. Clients may send
 * action/draft inputs, but they do not author the persisted historical snapshot."
 *
 * Everything in a step snapshot that is a projection of combat state is derived here. The figures
 * that need a Character build and an equipment loadout — the attack and defence summaries, the
 * attack-mode and parry-item labels, the target list and the pair distance label — are not
 * reachable from `CombatRoundState` alone, so they arrive through `resolveParticipantFigures`.
 * The API supplies that from its own canonical calculation adapters
 * (`combatStepSnapshotFigures.ts`), which read the participant's own equipment aggregate rather
 * than a presentation summary.
 *
 * This module deliberately does **not** change `COMBAT_ROUND_STEPS`, the at-or-before panel
 * fallback, or the tracker-cell index.
 */

export interface CombatStepSnapshotPhaseFigures {
  attackModeLabel?: string;
  attackSummary?: NonNullable<CombatRoundStepSnapshot["attackSummary"]>;
  defenseSummary?: NonNullable<CombatRoundStepSnapshot["defenseSummary"]>;
  distanceLabel?: string;
  mainHandParryItemLabel?: string;
  offHandParryItemLabel?: string;
  targetOptions?: { displayName: string; id: string }[];
}

export interface CombatStepSnapshotParticipantFigures {
  phase1: CombatStepSnapshotPhaseFigures;
  phase2: CombatStepSnapshotPhaseFigures;
}

export interface CombatStepSnapshotParticipantSource {
  /** Canonical modifier context for the participant, as the server holds it. */
  combatContext?: ScenarioParticipantCombatContext;
  combatEffects?: CombatEffectsState;
  /** The scenario participant id, used only to scope which canonical effects are this one's. */
  scenarioParticipantId?: string;
}

export interface DeriveCombatRoundStepSnapshotsInput {
  committedAt: string;
  encounterId?: string;
  /** Loadout-derived figures per participant. Absent figures are omitted, never defaulted. */
  resolveParticipantFigures?: (input: {
    participantId: string;
    state: CombatRoundState;
    step: CombatRoundStep;
  }) => CombatStepSnapshotParticipantFigures | undefined;
  /** Canonical participant sources keyed by the round participant id. */
  sourceByParticipantId?: Record<string, CombatStepSnapshotParticipantSource | undefined>;
  /** The state being committed. */
  state: CombatRoundState;
  /** Defaults to the state's own current step. */
  step?: CombatRoundStep;
}

function getCombatAttackPhaseForStep(step: CombatRoundStep): CombatRoundPhase | undefined {
  if (step === "phase_1_actions") return "phase1";
  if (step === "phase_2_actions") return "phase2";
  return undefined;
}

function getCombatResolutionStepKind(step: CombatRoundStep): "parry" | "damage" | undefined {
  if (step === "review_phase_2_actions" || step === "review_phase_2_damage") return "parry";
  if (step === "phase_1_damage" || step === "phase_2_damage") return "damage";
  return undefined;
}

function isInitiativeStep(step: CombatRoundStep): boolean {
  return step === "initiative_phase_1" || step === "initiative_phase_2";
}

function hasDeclaredAction(
  declaration: CombatRoundParticipantState["declaration"],
): declaration is NonNullable<CombatRoundParticipantState["declaration"]> {
  return Boolean(declaration?.actionId);
}

function collectCanonicalEffectsFromRows(
  rows: ReturnType<typeof buildCombatModifierRowProjection>,
): NonNullable<NonNullable<CombatRoundStepSnapshot["modifierSummary"]>["effects"]> {
  const effects: NonNullable<
    NonNullable<CombatRoundStepSnapshot["modifierSummary"]>["effects"]
  > = [];
  for (const row of rows) {
    for (const entry of row.entries as ScenarioCombatModifierEntry[]) {
      const parsed = canonicalCombatModifierEffectSchema.safeParse(entry.canonicalLifecycle);
      if (parsed.success) effects.push(parsed.data);
    }
    for (const derived of row.derivedEntries ?? []) {
      const parsed = canonicalCombatModifierEffectSchema.safeParse(derived.canonicalLifecycle);
      if (parsed.success) effects.push(parsed.data);
    }
  }
  return effects;
}

function deriveModifierSummary(input: {
  encounterId?: string;
  ownerParticipantIds: readonly string[];
  phaseKey?: CombatModifierRowPhaseKey;
  roundNumber: number;
  source?: CombatStepSnapshotParticipantSource;
  step: CombatRoundStep;
}): NonNullable<CombatRoundStepSnapshot["modifierSummary"]> {
  // Snapshot rows describe everything recorded at this point in the round. Phase filtering
  // belongs to calculation totals, not historical visibility, so the rows are read at the step.
  const recordedRows = buildCombatModifierRowProjection({
    combatContext: input.source?.combatContext,
    combatEffects: input.source?.combatEffects,
    currentRound: input.roundNumber,
    encounterId: input.encounterId,
    ownerParticipantId: input.source?.scenarioParticipantId,
    phaseKey: input.phaseKey,
    visibleAtStep: input.step,
  });
  // Calculation totals are read for the step's own phase.
  const applicableRows = buildCombatModifierRowProjection({
    combatContext: input.source?.combatContext,
    combatEffects: input.source?.combatEffects,
    currentRound: input.roundNumber,
    encounterId: input.encounterId,
    ownerParticipantId: input.source?.scenarioParticipantId,
    phaseKey: input.phaseKey,
  });
  const totalFor = (bucketKey: string) =>
    applicableRows.find((row) => row.bucketKey === bucketKey)?.total ?? 0;
  const owners = new Set(input.ownerParticipantIds.filter(Boolean));
  const effects = collectCanonicalEffectsFromRows(recordedRows).filter((effect) =>
    owners.has(effect.ownerParticipantId),
  );
  const uniqueEffects = [...new Map(effects.map((effect) => [effect.id, effect])).values()];
  const flatDbAdjustment = (input.source?.combatContext?.modifierBuckets.situationDb ?? [])
    .filter((entry) => entry.application === "flat_db")
    .reduce((total, entry) => total + entry.value, 0);

  return {
    dbFlatAdjustment: flatDbAdjustment,
    dbRaw: totalFor("situation_db"),
    effects: uniqueEffects,
    generalFatigueRaw: totalFor("general"),
    initiativeRaw: totalFor("situation_initiative"),
    obSkillRaw: totalFor("situation_ob_skill"),
    rows: recordedRows.map((row) => ({
      bucketKey: row.bucketKey,
      entries: row.entries,
      label: row.label,
      total: row.total,
    })),
  };
}

function deriveDeclarationSummary(
  participant: CombatRoundParticipantState,
): NonNullable<CombatRoundStepSnapshot["declarationSummary"]> {
  const declaration = hasDeclaredAction(participant.declaration)
    ? participant.declaration
    : undefined;

  return {
    actionId: declaration?.actionId || undefined,
    actionLabel: declaration?.actionId
      ? getCombatDeclarationActionLabel(declaration.actionId)
      : undefined,
    additionalActionNotes: declaration?.additionalActionNotes || undefined,
    adjustDistance: declaration?.adjustDistance,
    feint:
      declaration?.actionId === "feint_attack" && declaration.feint
        ? {
            attackerSkillId: declaration.feint.attackerSkillId,
            defenderSkillId: declaration.feint.defenderSkillId,
            method: declaration.feint.method,
            targetParticipantId: declaration.feint.targetParticipantId,
          }
        : undefined,
    intent: declaration?.intent,
    movementId: declaration?.movementId || undefined,
    movementIntent: declaration?.movementIntent,
    movementLabel: declaration?.movementIntent
      ? (getMovementIntentLabel(declaration.movementIntent) ?? undefined)
      : undefined,
    secondaryActionContext: declaration?.secondaryActionContext,
    secondaryActionId: declaration?.secondaryActionId || undefined,
    secondaryActionLabel: declaration?.secondaryActionId
      ? getCombatDeclarationActionLabel(declaration.secondaryActionId)
      : undefined,
  };
}

/**
 * Derives the authoritative snapshot of one step, for every participant in the round, from the
 * state being committed.
 */
export function deriveCombatRoundStepSnapshots(
  input: DeriveCombatRoundStepSnapshotsInput,
): CombatRoundStepSnapshot[] {
  const state = combatRoundStateSchema.parse(input.state);
  const step = input.step ?? state.currentStep;
  const phase = getCombatRoundModifierPhaseForStep(step);
  const attackPhase = getCombatAttackPhaseForStep(step);
  const resolutionStepKind = getCombatResolutionStepKind(step);
  const ranks = phase ? getCombatRoundInitiativeRanks({ phase, state }) : {};

  return state.participants.map((participant) => {
    const source = input.sourceByParticipantId?.[participant.participantId];
    const figures = input.resolveParticipantFigures?.({
      participantId: participant.participantId,
      state,
      step,
    });
    const phaseFigures = phase ? figures?.[phase] : undefined;
    const initiativeResult = phase ? participant.initiatives[phase] : undefined;
    const attackResult = attackPhase
      ? getCombatRoundOutgoingAttackResultForParticipantPhase({
          participantId: participant.participantId,
          phase: attackPhase,
          state,
        })
      : phase && resolutionStepKind
        ? getCombatRoundDisplayIncomingAttackResultForParticipantPhase({
            participantId: participant.participantId,
            phase,
            state,
          })
        : undefined;
    const phaseResolutionResult =
      phase && resolutionStepKind && attackResult
        ? (getCombatRoundPhaseResolutionResultForAttack({ attackResult, state }) ??
          buildCombatRoundPhaseResolutionResult({
            attackResult,
            roundNumber: state.roundNumber,
            updatedAt: input.committedAt,
          }))
        : undefined;
    const phaseResolutionStatus = phase
      ? getCombatRoundPhaseResolutionStatus({
          participantId: participant.participantId,
          phase,
          state,
        })
      : undefined;
    // The step's own recorded result, keyed on the step. A step with no attack and no initiative
    // of its own records that it had none rather than inheriting a neighbour's figure.
    const actionResultStatus: NonNullable<CombatRoundStepSnapshot["actionResultStatus"]> =
      attackResult
        ? "recorded"
        : isInitiativeStep(step) && initiativeResult
          ? "recorded"
          : participant.stepStatuses[step] === "skipped"
            ? "skipped"
            : attackPhase || (phase && resolutionStepKind)
              ? "no_attack"
              : "no_result";
    const actionResultReason =
      step === "phase_2_actions" &&
      participant.declaration?.actionId === "double_attack" &&
      participant.declaration.attackOpportunities?.some(
        (opportunity) =>
          opportunity.origin === "double_attack" &&
          opportunity.phase === "phase2" &&
          opportunity.status === "cancelled",
      )
        ? ("double_attack_cancelled" as const)
        : undefined;
    const buildPhasePanel = (phaseKey: CombatRoundPhase) => {
      const panelFigures = figures?.[phaseKey];
      const phaseContext = participant.declaration?.phaseContexts?.[phaseKey];
      if (!phaseContext) return undefined;
      return {
        attackModeLabel: panelFigures?.attackModeLabel,
        attackSummary: panelFigures?.attackSummary,
        defenseSummary: panelFigures?.defenseSummary,
        distanceLabel: panelFigures?.distanceLabel,
        mainHandParryItemLabel: panelFigures?.mainHandParryItemLabel,
        offHandParryItemLabel: panelFigures?.offHandParryItemLabel,
        phaseContext,
        targetOptions: panelFigures?.targetOptions ?? [],
      };
    };
    const phase1Panel = buildPhasePanel("phase1");
    const phase2Panel = buildPhasePanel("phase2");

    return {
      actionResultReason,
      actionResultStatus,
      attackResult,
      attackSummary: phaseFigures?.attackSummary,
      committedAt: input.committedAt,
      declarationSummary: deriveDeclarationSummary(participant),
      defenseSummary: phaseFigures?.defenseSummary,
      id: `${state.roundNumber}:${participant.participantId}:${step}`,
      initiativeRank: initiativeResult ? ranks[participant.participantId] : undefined,
      initiativeResult,
      modifierSummary: deriveModifierSummary({
        encounterId: input.encounterId,
        ownerParticipantIds: [
          participant.participantId,
          source?.scenarioParticipantId ?? participant.participantId,
        ],
        phaseKey: phase ?? getCombatModifierRowPhaseKeyForStep(step),
        roundNumber: state.roundNumber,
        source,
        step,
      }),
      participantId: participant.participantId,
      participantLabel: participant.label,
      phase,
      phaseContext: phase ? participant.declaration?.phaseContexts?.[phase] : undefined,
      phasePanels:
        phase1Panel || phase2Panel
          ? {
              ...(phase1Panel ? { phase1: phase1Panel } : {}),
              ...(phase2Panel ? { phase2: phase2Panel } : {}),
            }
          : undefined,
      phaseResolutionResult,
      phaseResolutionStatus,
      roundNumber: state.roundNumber,
      step,
    } satisfies CombatRoundStepSnapshot;
  });
}

/**
 * Every step the committed transition leaves behind, in `COMBAT_ROUND_STEPS` order.
 *
 * A boundary advance can jump several steps at once — `phase1_resolution:phase2_modifier_review`
 * leaves `review_phase_2_actions` and `phase_1_damage` behind without ever making them current.
 * Those steps are part of the round's history and the inspector can select them, so each one is
 * recorded from the state that was committed when it was passed. A transition that does not move
 * the step refreshes that step's own record, which is what a modifier-review commit needs.
 */
export function getCommittedCombatRoundSteps(input: {
  nextStep: CombatRoundStep;
  previousStep: CombatRoundStep;
  startsNextRound: boolean;
}): CombatRoundStep[] {
  const previousIndex = COMBAT_ROUND_STEPS.indexOf(input.previousStep);
  if (previousIndex < 0) return [];
  if (input.startsNextRound) {
    // The round boundary completes the round: every step from the one being left to the last.
    return COMBAT_ROUND_STEPS.slice(previousIndex);
  }
  const nextIndex = COMBAT_ROUND_STEPS.indexOf(input.nextStep);
  if (nextIndex <= previousIndex) return [input.previousStep];
  return COMBAT_ROUND_STEPS.slice(previousIndex, nextIndex);
}

export interface WithDerivedCombatRoundStepSnapshotsInput
  extends Omit<DeriveCombatRoundStepSnapshotsInput, "state" | "step"> {
  /** The state the transition produced. Snapshots are upserted into this one. */
  nextState: CombatRoundState;
  /** The state being committed — every derived figure is read from this one. */
  previousState: CombatRoundState;
}

/**
 * Upserts the server-derived snapshots for every step the commit left behind.
 *
 * Snapshots are always derived from `previousState`, never from the transitioned state: the
 * record is of the state that was committed.
 */
export function withDerivedCombatRoundStepSnapshots(
  input: WithDerivedCombatRoundStepSnapshotsInput,
): CombatRoundState {
  const previousState = combatRoundStateSchema.parse(input.previousState);
  const nextState = combatRoundStateSchema.parse(input.nextState);
  const startsNextRound = nextState.roundNumber > previousState.roundNumber;
  const steps = getCommittedCombatRoundSteps({
    nextStep: nextState.currentStep,
    previousStep: previousState.currentStep,
    startsNextRound,
  });
  const snapshots = steps.flatMap((step) =>
    deriveCombatRoundStepSnapshots({
      committedAt: input.committedAt,
      encounterId: input.encounterId,
      resolveParticipantFigures: input.resolveParticipantFigures,
      sourceByParticipantId: input.sourceByParticipantId,
      state: previousState,
      step,
    }),
  );
  if (snapshots.length === 0) return nextState;

  if (!startsNextRound) {
    return upsertCombatRoundStepSnapshots({ snapshots, state: nextState });
  }

  // The completed round is archived with its own snapshots and the live round restarts empty, so
  // the records go into the archived round rather than the fresh one.
  const completedRoundNumber = previousState.roundNumber;
  return combatRoundStateSchema.parse({
    ...nextState,
    rounds: nextState.rounds.map((round) =>
      round.roundNumber === completedRoundNumber
        ? {
            ...round,
            stepSnapshots: [
              ...round.stepSnapshots.filter(
                (existing) =>
                  !snapshots.some(
                    (snapshot) =>
                      snapshot.participantId === existing.participantId &&
                      snapshot.roundNumber === existing.roundNumber &&
                      snapshot.step === existing.step,
                  ),
              ),
              ...snapshots,
            ],
          }
        : round,
    ),
  });
}
