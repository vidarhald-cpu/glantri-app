import {
  buildCombatActionProcessPlans,
  type CombatActionProcessPlan,
  type CombatActionProcessStage,
  type CombatActionProcessTaskDescriptor,
  type CombatManeuverTaskDescriptor,
} from "../combatActionProcesses";
import { validateCombatDeclarationCompatibility } from "../combatDeclarationCompatibility";
import {
  canonicalCombatModifierReviewInputSchema,
  getCanonicalCombatModifierReviewState,
} from "../combatModifierReview";
import { buildCombatRoundEndProcessPlan } from "../combatRoundEndProcesses";
import {
  activeCombatRoundStateSchema,
  combatRoundStateSchema,
  getCombatRoundCurrentInitiativeExecutionGroup,
  getCombatRoundPhaseCombatExperienceRequirement,
  getCombatRoundPhaseInitiativeChoice,
  getPendingCombatObservationAttempts,
  isCombatStartExperienceRollRequired,
  sortCombatRoundEndDistanceProposals,
  type CombatRoundPhase,
  type CombatRoundState,
} from "../combatRoundManager";
import {
  CANONICAL_COMBAT_PARTICIPATION_SCHEMA_VERSION,
  combatParticipationFactSchema,
  combatParticipationProjectionSchema,
  playerSafeCombatParticipationProjectionSchema,
  type CombatParticipantAuthoritySource,
  type CombatParticipationCompleteness,
  type CombatParticipationFact,
  type CombatParticipationOrdering,
  type CombatParticipationOwnership,
  type CombatParticipationProcessFamily,
  type CombatParticipationProjection,
  type CombatParticipationProjectionInput,
  type CombatParticipationProxyAuthoritySource,
  type CombatParticipationReason,
  type CombatParticipationStatus,
  type CombatParticipationWorkClass,
  type PlayerSafeCombatParticipationProjection,
} from "./types";

interface ProjectionContext {
  readonly actionPlans: readonly CombatActionProcessPlan[];
  readonly authorities: ReadonlyMap<string, CombatParticipantAuthoritySource>;
  readonly encounterId: string;
  readonly facts: CombatParticipationFact[];
  readonly input: CombatParticipationProjectionInput;
  readonly proxies: readonly CombatParticipationProxyAuthoritySource[];
  readonly revision: string;
  readonly sequence: number;
  readonly state: CombatRoundState;
}

interface AddFactInput {
  readonly actionProcessId?: string;
  readonly attackResultId?: string;
  readonly completeness?: CombatParticipationCompleteness;
  readonly initiativeGroupId?: string;
  readonly opponentParticipantId?: string;
  readonly opportunityId?: string;
  readonly ordering?: CombatParticipationOrdering;
  readonly ownership: CombatParticipationOwnership;
  readonly pairId?: string;
  readonly participantId?: string;
  readonly phase?: CombatRoundPhase;
  readonly processFamily: CombatParticipationProcessFamily;
  readonly processId?: string;
  readonly proposalId?: string;
  readonly reason: CombatParticipationReason;
  readonly status: CombatParticipationStatus;
  readonly step: string;
  readonly workClass: CombatParticipationWorkClass;
}

function freeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value as Record<string, unknown>)) freeze(nested);
  return value;
}

function isHeldForExplicitGmBacktrack(context: ProjectionContext, input: AddFactInput): boolean {
  const hold = context.state.gmBacktrackHold;
  if (!hold || hold.roundNumber !== context.state.roundNumber) return false;
  if ((input.completeness ?? "complete") !== "complete" || input.status === "blocked") return false;

  const participantMatches =
    hold.participantId === undefined ||
    input.participantId === undefined ||
    hold.participantId === input.participantId;
  if (!participantMatches) return false;

  if (
    input.processFamily === "modifier_review" &&
    ((hold.step === "review_action_modifiers" && input.phase === "phase1") ||
      (hold.step === "review_phase_2_modifiers" && input.phase === "phase2"))
  ) {
    return input.status === "not_required" && input.workClass === "no_work";
  }

  if (input.status !== "required" || input.workClass !== "deterministic_transition") {
    return false;
  }

  if (hold.step === "select_actions") {
    return input.processFamily === "boundary" && input.step === "declaration_boundary";
  }
  if (hold.step === "initiative_phase_1") {
    return input.processFamily === "boundary" && input.step === "commit_i1";
  }
  if (hold.step === "initiative_phase_2") {
    return input.processFamily === "boundary" && input.step === "commit_i2";
  }
  if (
    hold.step === "phase_1_actions" ||
    hold.step === "review_phase_2_actions" ||
    hold.step === "phase_1_damage"
  ) {
    return input.phase === "phase1";
  }
  if (
    hold.step === "phase_2_actions" ||
    hold.step === "review_phase_2_damage" ||
    hold.step === "phase_2_damage"
  ) {
    return input.phase === "phase2";
  }
  return hold.step === "round_summary";
}

function addFact(context: ProjectionContext, input: AddFactInput): CombatParticipationFact {
  const effectiveInput = isHeldForExplicitGmBacktrack(context, input)
    ? {
        ...input,
        reason: "unresolved_choice" as const,
        status: "required" as const,
        workClass: "human_decision" as const,
      }
    : input;
  const identity = {
    actionProcessId: effectiveInput.actionProcessId,
    attackResultId: effectiveInput.attackResultId,
    encounterId: context.encounterId,
    encounterRevision: context.revision,
    initiativeGroupId: effectiveInput.initiativeGroupId,
    opponentParticipantId: effectiveInput.opponentParticipantId,
    opportunityId: effectiveInput.opportunityId,
    pairId: effectiveInput.pairId,
    participantId: effectiveInput.participantId,
    phase: effectiveInput.phase,
    processFamily: effectiveInput.processFamily,
    processId: effectiveInput.processId,
    proposalId: effectiveInput.proposalId,
    roundNumber: context.state.roundNumber,
    sequence: context.sequence,
    step: effectiveInput.step,
  };
  const id = [
    `combat-participation-v${CANONICAL_COMBAT_PARTICIPATION_SCHEMA_VERSION}`,
    context.encounterId,
    context.state.roundNumber,
    effectiveInput.processFamily,
    effectiveInput.step,
    effectiveInput.phase,
    effectiveInput.participantId,
    effectiveInput.opportunityId,
    effectiveInput.proposalId,
    effectiveInput.processId,
  ]
    .filter((part) => part !== undefined)
    .join(":");
  const fact = combatParticipationFactSchema.parse({
    completeness: effectiveInput.completeness ?? "complete",
    id,
    identity,
    ordering: effectiveInput.ordering ?? "none",
    ownership: effectiveInput.ownership,
    reason: effectiveInput.reason,
    schemaVersion: CANONICAL_COMBAT_PARTICIPATION_SCHEMA_VERSION,
    status: effectiveInput.status,
    workClass: effectiveInput.workClass,
  });
  context.facts.push(fact);
  return fact;
}

function findProxy(
  context: ProjectionContext,
  participantId: string,
  processFamily: CombatParticipationProcessFamily,
  phase?: CombatRoundPhase,
  actionProcessId?: string,
): CombatParticipationProxyAuthoritySource | undefined {
  return context.proxies.find(
    (proxy) =>
      proxy.active &&
      proxy.participantId === participantId &&
      proxy.processFamily === processFamily &&
      (proxy.phase === undefined || proxy.phase === phase) &&
      (proxy.actionProcessId === undefined || proxy.actionProcessId === actionProcessId),
  );
}

function participantOwnership(
  context: ProjectionContext,
  participantId: string,
  processFamily: CombatParticipationProcessFamily,
  phase?: CombatRoundPhase,
  actionProcessId?: string,
): CombatParticipationOwnership {
  const proxy = findProxy(context, participantId, processFamily, phase, actionProcessId);
  if (proxy) {
    return { kind: "gm_proxy", participantId, proxyUserId: proxy.proxyUserId };
  }
  const authority = context.authorities.get(participantId);
  if (!authority) return { kind: "unknown", participantId };
  return {
    kind: authority.authority === "player" ? "player_owned" : "gm_controlled_participant",
    participantId,
  };
}

function participantDecision(
  context: ProjectionContext,
  participantId: string,
  processFamily: CombatParticipationProcessFamily,
  phase?: CombatRoundPhase,
  actionProcessId?: string,
): Pick<AddFactInput, "completeness" | "ownership" | "status" | "workClass"> {
  const ownership = participantOwnership(
    context,
    participantId,
    processFamily,
    phase,
    actionProcessId,
  );
  return ownership.kind === "unknown"
    ? { completeness: "partial", ownership, status: "blocked", workClass: "human_decision" }
    : { ownership, status: "required", workClass: "human_decision" };
}

function participantRoll(
  context: ProjectionContext,
  participantId: string,
  processFamily: CombatParticipationProcessFamily,
  phase?: CombatRoundPhase,
  actionProcessId?: string,
): Pick<AddFactInput, "completeness" | "ownership" | "status" | "workClass"> {
  const ownership = participantOwnership(
    context,
    participantId,
    processFamily,
    phase,
    actionProcessId,
  );
  if (ownership.kind === "unknown") {
    return { completeness: "partial", ownership, status: "blocked", workClass: "human_decision" };
  }
  return {
    ownership,
    status: "required",
    workClass: ownership.kind === "player_owned" ? "player_roll" : "gm_roll",
  };
}

function projectCombatStartExperience(context: ProjectionContext): void {
  const requiredParticipants = context.state.participants.filter((participant) =>
    isCombatStartExperienceRollRequired({
      participantId: participant.participantId,
      state: context.state,
    }),
  );
  addFact(context, {
    ordering: "ownerless_boundary",
    ownership: { kind: "gm_owned" },
    processFamily: "combat_start_experience",
    reason:
      context.state.roundNumber === 1 &&
      requiredParticipants.length > 0 &&
      context.state.combatExperienceDifficulty === undefined
        ? "unresolved_choice"
        : requiredParticipants.length > 0
          ? "already_resolved"
          : "no_executable_phase_action",
    status:
      context.state.roundNumber === 1 &&
      requiredParticipants.length > 0 &&
      context.state.combatExperienceDifficulty === undefined
        ? "required"
        : context.state.combatExperienceDifficulty !== undefined
          ? "already_resolved"
          : "not_required",
    step: "difficulty",
    workClass:
      context.state.roundNumber === 1 &&
      requiredParticipants.length > 0 &&
      context.state.combatExperienceDifficulty === undefined
        ? "human_decision"
        : "no_work",
  });

  for (const participant of context.state.participants) {
    const required = requiredParticipants.some(
      (candidate) => candidate.participantId === participant.participantId,
    );
    const resolved = participant.combatExperience !== undefined;
    const roll = participantRoll(context, participant.participantId, "combat_start_experience");
    addFact(context, {
      ...(required ? roll : {}),
      completeness: required ? roll.completeness : "complete",
      ordering: "participant_sequence",
      ownership:
        required || resolved
          ? participantOwnership(context, participant.participantId, "combat_start_experience")
          : { kind: "unknown", participantId: participant.participantId },
      participantId: participant.participantId,
      processFamily: "combat_start_experience",
      reason: resolved
        ? "already_resolved"
        : required
          ? "combat_experience_roll_required"
          : "no_combat_experience_work",
      status: resolved ? "already_resolved" : required ? roll.status : "not_required",
      step: "roll",
      workClass: resolved ? "no_work" : required ? roll.workClass : "no_work",
    });
  }
}

function projectDeclarations(context: ProjectionContext): void {
  const sourceByParticipant = new Map(
    (context.input.declarationSources ?? []).map((source) => [source.participantId, source]),
  );
  for (const participant of context.state.participants) {
    const source = sourceByParticipant.get(participant.participantId);
    const actionId = participant.declaration?.actionId;
    const compatibility = validateCombatDeclarationCompatibility({
      movementKind: participant.declaration?.movementIntent?.mode,
      primaryAction: actionId,
      secondaryAction: participant.declaration?.secondaryActionId,
    });
    const declarationStatus = participant.stepStatuses.select_actions;
    const resolved =
      declarationStatus === "submitted" ||
      declarationStatus === "gmEdited" ||
      declarationStatus === "complete" ||
      declarationStatus === "locked";
    const forcedNoAction = Boolean(
      source?.completeness === "complete" && source.forcedNoAction && source.legalChoiceCount === 0,
    );
    const unsupported = !compatibility.valid;
    const decision = participantDecision(context, participant.participantId, "declaration");
    addFact(context, {
      completeness: unsupported
        ? "unsupported"
        : (source?.completeness ?? (resolved ? "complete" : "legacy_incomplete")),
      ordering: "participant_sequence",
      ownership: participantOwnership(context, participant.participantId, "declaration"),
      participantId: participant.participantId,
      processFamily: "declaration",
      reason: unsupported
        ? "stale_or_invalid_source"
        : resolved
          ? "already_resolved"
          : forcedNoAction
            ? "no_executable_phase_action"
            : "declaration_required",
      status: unsupported
        ? "blocked"
        : resolved
          ? "already_resolved"
          : forcedNoAction
            ? "not_required"
            : decision.status,
      step: "DE",
      workClass: unsupported || resolved || forcedNoAction ? "no_work" : decision.workClass,
    });
  }
}

function projectModifierReviews(context: ProjectionContext): void {
  const reviews = new Map(
    (context.input.modifierReviewSources ?? []).map((source) => {
      const normalized = canonicalCombatModifierReviewInputSchema.parse(source.review);
      return [`${source.participantId}:${source.phase}`, normalized] as const;
    }),
  );
  for (const review of context.input.modifierReviews ?? []) {
    const normalized = canonicalCombatModifierReviewInputSchema.parse(review);
    reviews.set(`${normalized.participantId}:${normalized.phase}`, normalized);
  }
  for (const phase of ["phase1", "phase2"] as const) {
    const reviewPhase = phase === "phase1" ? "M1" : "M2";
    for (const participant of context.state.participants) {
      const review = reviews.get(`${participant.participantId}:${reviewPhase}`);
      const completeStatus =
        participant.stepStatuses[
          phase === "phase1" ? "review_action_modifiers" : "review_phase_2_modifiers"
        ];
      const resolved =
        completeStatus === "complete" ||
        completeStatus === "gmEdited" ||
        completeStatus === "locked" ||
        completeStatus === "skipped" ||
        completeStatus === "submitted";
      if (resolved) {
        addFact(context, {
          ordering: "participant_sequence",
          ownership: { kind: "gm_owned", participantId: participant.participantId },
          participantId: participant.participantId,
          phase,
          processFamily: "modifier_review",
          reason: "already_resolved",
          status: "already_resolved",
          step: reviewPhase,
          workClass: "no_work",
        });
        continue;
      }
      if (!review) {
        addFact(context, {
          completeness: "legacy_incomplete",
          ordering: "participant_sequence",
          ownership: { kind: "gm_owned", participantId: participant.participantId },
          participantId: participant.participantId,
          phase,
          processFamily: "modifier_review",
          reason: "stale_or_invalid_source",
          status: "blocked",
          step: reviewPhase,
          workClass: "human_decision",
        });
        continue;
      }
      const blocked = getCanonicalCombatModifierReviewState(review) === "blocked";
      const unresolvedRequiredRoll = review.requiredRolls.some(
        (roll) => roll.owner === "modifier_review" && roll.blocksReview && !roll.resolved,
      );
      addFact(context, {
        ordering: "participant_sequence",
        ownership: { kind: "gm_owned", participantId: participant.participantId },
        participantId: participant.participantId,
        phase,
        processFamily: "modifier_review",
        // M1 and M2 are deliberate GM checkpoints. Even an otherwise empty canonical
        // snapshot retains the unresolved decision to inspect or create a situational
        // modifier and explicitly confirm progression.
        reason: "modifier_review_required",
        status: blocked || unresolvedRequiredRoll ? "blocked" : "required",
        step: reviewPhase,
        workClass: "human_decision",
      });
    }
  }
}

function phaseOpportunityPlans(context: ProjectionContext, phase: CombatRoundPhase) {
  return context.actionPlans.flatMap((plan) =>
    plan.standardAttacks
      .filter((attack) => attack.phase === phase)
      .map((attack) => ({ attack, plan })),
  );
}

function hasValidOpportunity(entry: ReturnType<typeof phaseOpportunityPlans>[number]): boolean {
  return entry.attack.prerequisites.every((prerequisite) => prerequisite.satisfied);
}

function hasOrderedManeuver(plan: CombatActionProcessPlan, phase: CombatRoundPhase): boolean {
  return phase === "phase1" && Boolean(plan.maneuver);
}

function projectInitiative(context: ProjectionContext): void {
  for (const phase of ["phase1", "phase2"] as const) {
    const opportunityEntries = phaseOpportunityPlans(context, phase);
    const executableParticipantIds = new Set(
      opportunityEntries.filter(hasValidOpportunity).map((entry) => entry.plan.ownerParticipantId),
    );
    for (const plan of context.actionPlans) {
      if (hasOrderedManeuver(plan, phase) && !plan.maneuver?.completion.complete) {
        executableParticipantIds.add(plan.ownerParticipantId);
      }
    }
    const competing = executableParticipantIds.size > 1;
    const initiativeGroup = getCombatRoundCurrentInitiativeExecutionGroup({
      phase,
      state: context.state,
    });
    for (const participant of context.state.participants) {
      const plan = context.actionPlans.find(
        (candidate) => candidate.ownerParticipantId === participant.participantId,
      );
      const hasAction = executableParticipantIds.has(participant.participantId);
      const orderedManeuver = Boolean(plan && hasOrderedManeuver(plan, phase));
      const resolved = participant.initiatives[phase] !== undefined;
      const unresolvedDoubleAttackChoice = Boolean(
        phase === "phase2" && plan?.decisionGate?.required && plan.decisionGate.state === "ready",
      );
      const required = hasAction && (competing || orderedManeuver);
      const roll = participantRoll(
        context,
        participant.participantId,
        "initiative",
        phase,
        plan?.id,
      );
      addFact(context, {
        actionProcessId: plan?.id,
        completeness: hasAction || resolved ? roll.completeness : "complete",
        initiativeGroupId: initiativeGroup?.id,
        ordering: required ? (initiativeGroup ? "initiative_group" : "initiative_order") : "none",
        ownership: participantOwnership(
          context,
          participant.participantId,
          "initiative",
          phase,
          plan?.id,
        ),
        participantId: participant.participantId,
        phase,
        processFamily: "initiative",
        reason: resolved
          ? "already_resolved"
          : unresolvedDoubleAttackChoice
            ? "unresolved_choice"
            : !hasAction
              ? "no_executable_phase_action"
              : required
                ? "initiative_order_required"
                : "sole_actor_order_irrelevant",
        status: resolved
          ? "already_resolved"
          : unresolvedDoubleAttackChoice
            ? "conditional"
            : !hasAction || !required
              ? "not_required"
              : roll.status,
        step: phase === "phase1" ? "i1" : "i2",
        workClass: resolved || !hasAction || !required ? "no_work" : roll.workClass,
      });
    }
    const allRequiredResolved = context.state.participants
      .filter((participant) => {
        const plan = context.actionPlans.find(
          (candidate) => candidate.ownerParticipantId === participant.participantId,
        );
        return (
          executableParticipantIds.has(participant.participantId) &&
          (competing || Boolean(plan && hasOrderedManeuver(plan, phase)))
        );
      })
      .every((participant) => participant.initiatives[phase] !== undefined);
    addFact(context, {
      ordering: "ownerless_boundary",
      ownership: { kind: "ownerless" },
      phase,
      processFamily: "boundary",
      reason: allRequiredResolved ? "deterministic_boundary" : "initiative_order_required",
      status: allRequiredResolved ? "required" : "conditional",
      step: phase === "phase1" ? "commit_i1" : "commit_i2",
      workClass: "deterministic_transition",
    });
  }
}

function stageProcessFamily(
  stage: CombatActionProcessStage,
): "phase_action" | "phase_response" | "damage_chain" | "offensive_parry" {
  if (stage.kind === "attack") return "phase_action";
  if (stage.kind === "defense") return "phase_response";
  if (stage.kind === "offensive_parry_contest") return "offensive_parry";
  return "damage_chain";
}

function actionTaskParticipantId(
  plan: CombatActionProcessPlan,
  stage: CombatActionProcessStage,
  task: CombatActionProcessTaskDescriptor | undefined,
  targetParticipantId?: string,
): string | undefined {
  if (!task) {
    if (stage.kind === "defense") return targetParticipantId;
    if (stage.kind === "commit") return undefined;
    return plan.ownerParticipantId;
  }
  if (task.owner === "attacker") return plan.ownerParticipantId;
  if (task.owner === "defender") return targetParticipantId;
  if (task.owner === "offensive_parry_controller") return task.declaredOpponentParticipantId;
  if (task.owner === "offensive_parry_responder") return targetParticipantId;
  return undefined;
}

function projectActionProcesses(context: ProjectionContext): void {
  const participantsWithPhaseAction = new Set<string>();
  for (const plan of context.actionPlans) {
    if (plan.decisionGate) {
      const gate = plan.decisionGate;
      const decision = participantDecision(
        context,
        gate.ownerParticipantId,
        "double_attack_decision",
        "phase2",
        plan.id,
      );
      addFact(context, {
        actionProcessId: plan.id,
        completeness: decision.completeness,
        opportunityId: gate.opportunityId,
        ordering: "participant_sequence",
        ownership: participantOwnership(
          context,
          gate.ownerParticipantId,
          "double_attack_decision",
          "phase2",
          plan.id,
        ),
        participantId: gate.ownerParticipantId,
        phase: "phase2",
        processFamily: "double_attack_decision",
        processId: gate.id,
        reason: gate.state === "complete" ? "already_resolved" : "unresolved_choice",
        status:
          gate.state === "complete"
            ? "already_resolved"
            : gate.state === "ready"
              ? decision.status
              : "conditional",
        step: "M2_decision",
        workClass: gate.state === "complete" ? "no_work" : "human_decision",
      });
    }

    if (plan.maneuver) projectManeuver(context, plan);

    for (const attack of plan.standardAttacks) {
      participantsWithPhaseAction.add(`${plan.ownerParticipantId}:${attack.phase}`);
      const prerequisitesSatisfied = attack.prerequisites.every(
        (prerequisite) => prerequisite.satisfied,
      );
      for (const stage of attack.stages) {
        const processFamily = stageProcessFamily(stage);
        const task = stage.task ?? stage.tasks?.[0];
        const participantId = actionTaskParticipantId(
          plan,
          stage,
          task,
          attack.targetParticipantId,
        );
        const isGmTask = task?.owner === "gm";
        const isDeterministicTransition = stage.kind === "commit";
        const status: CombatParticipationStatus = !prerequisitesSatisfied
          ? "blocked"
          : stage.state === "complete"
            ? "already_resolved"
            : stage.state === "skipped"
              ? stage.kind === "attack"
                ? "already_resolved"
                : "not_required"
              : stage.state === "ready"
                ? "required"
                : "conditional";
        const roll = participantId
          ? participantRoll(context, participantId, processFamily, attack.phase, plan.id)
          : undefined;
        const ownership: CombatParticipationOwnership = isDeterministicTransition
          ? { kind: "ownerless" }
          : isGmTask
            ? { kind: "gm_owned", participantId }
            : participantId
              ? participantOwnership(context, participantId, processFamily, attack.phase, plan.id)
              : { kind: "unknown" };
        addFact(context, {
          actionProcessId: plan.id,
          attackResultId: attack.attackResultId,
          completeness: !prerequisitesSatisfied ? "partial" : roll?.completeness,
          opponentParticipantId: attack.targetParticipantId,
          opportunityId: attack.opportunity.id,
          ordering: isDeterministicTransition ? "ownerless_boundary" : "initiative_group",
          ownership,
          participantId,
          phase: attack.phase,
          processFamily,
          processId: stage.id,
          reason:
            status === "already_resolved"
              ? "already_resolved"
              : !prerequisitesSatisfied
                ? "stale_or_invalid_source"
                : isDeterministicTransition
                  ? "deterministic_boundary"
                  : stage.kind === "attack"
                    ? "attack_opportunity"
                    : stage.kind === "defense" || stage.kind === "offensive_parry_contest"
                      ? "response_required"
                      : "damage_chain_required",
          status: stage.state === "ready" && roll?.status === "blocked" ? "blocked" : status,
          step: stage.kind,
          workClass:
            status === "already_resolved" || status === "not_required"
              ? "no_work"
              : isDeterministicTransition
                ? "deterministic_transition"
                : isGmTask
                  ? "human_decision"
                  : (roll?.workClass ?? "human_decision"),
        });
      }
    }
  }

  for (const participant of context.state.participants) {
    for (const phase of ["phase1", "phase2"] as const) {
      if (participantsWithPhaseAction.has(`${participant.participantId}:${phase}`)) continue;
      addFact(context, {
        ownership: participantOwnership(context, participant.participantId, "phase_action", phase),
        participantId: participant.participantId,
        phase,
        processFamily: "phase_action",
        reason: "no_executable_phase_action",
        status: "not_required",
        step: phase === "phase1" ? "A1" : "A2",
        workClass: "no_work",
      });
    }
  }
}

function maneuverTaskParticipantId(
  plan: CombatActionProcessPlan,
  task: CombatManeuverTaskDescriptor,
): string | undefined {
  return task.ownerRole === "participant" ? task.ownerParticipantId : undefined;
}

function projectManeuver(context: ProjectionContext, plan: CombatActionProcessPlan): void {
  const maneuver = plan.maneuver;
  if (!maneuver) return;
  const processFamily = maneuver.maneuverKind === "feint" ? "feint" : "adjust_distance";
  for (const stage of maneuver.stages) {
    const tasks = [stage.task, ...(stage.tasks ?? [])].filter(
      (task): task is CombatManeuverTaskDescriptor => task !== undefined,
    );
    if (tasks.length === 0) {
      addFact(context, {
        actionProcessId: plan.id,
        completeness: maneuver.prerequisites.every((prerequisite) => prerequisite.satisfied)
          ? "complete"
          : "partial",
        opponentParticipantId: maneuver.targetParticipantId,
        ordering: "pair_order",
        ownership: {
          kind: "shared_pair",
          roles: [
            {
              authority:
                context.authorities.get(maneuver.ownerParticipantId)?.authority ?? "unknown",
              participantId: maneuver.ownerParticipantId,
              role: "initiator",
            },
            ...(maneuver.targetParticipantId
              ? [
                  {
                    authority:
                      context.authorities.get(maneuver.targetParticipantId)?.authority ?? "unknown",
                    participantId: maneuver.targetParticipantId,
                    role: "responder",
                  } as const,
                ]
              : []),
          ],
        },
        pairId: maneuver.pairId,
        phase: "phase1",
        processFamily,
        processId: stage.id,
        proposalId: maneuver.proposalId,
        reason: stage.state === "complete" ? "already_resolved" : "unresolved_choice",
        status:
          stage.state === "complete"
            ? "already_resolved"
            : stage.state === "skipped"
              ? "not_required"
              : "conditional",
        step: stage.kind,
        workClass: stage.state === "complete" ? "no_work" : "human_decision",
      });
      continue;
    }
    for (const task of tasks) {
      const participantId = maneuverTaskParticipantId(plan, task);
      const rollTask =
        task.kind.endsWith("_roll") ||
        stage.kind === "attacker_roll" ||
        stage.kind === "defender_roll";
      const roll = participantId
        ? participantRoll(context, participantId, processFamily, "phase1", plan.id)
        : undefined;
      addFact(context, {
        actionProcessId: plan.id,
        opponentParticipantId: maneuver.targetParticipantId,
        opportunityId: task.opportunityId,
        ordering:
          stage.executionStrategy === "parallel_all" ? "pair_order" : "participant_sequence",
        ownership:
          task.ownerRole === "gm"
            ? { kind: "gm_owned" }
            : participantId
              ? participantOwnership(context, participantId, processFamily, "phase1", plan.id)
              : { kind: "unknown" },
        pairId: task.pairId,
        participantId,
        phase: "phase1",
        processFamily,
        processId: stage.id,
        proposalId: task.proposalId,
        reason:
          stage.state === "complete"
            ? "already_resolved"
            : rollTask
              ? "response_required"
              : "unresolved_choice",
        status:
          stage.state === "complete"
            ? "already_resolved"
            : stage.state === "skipped"
              ? "not_required"
              : stage.state === "ready"
                ? (roll?.status ?? "required")
                : "conditional",
        step: task.kind,
        workClass:
          stage.state === "complete" || stage.state === "skipped"
            ? "no_work"
            : rollTask
              ? (roll?.workClass ?? "human_decision")
              : "human_decision",
      });
    }
  }
}

function projectPhaseCombatExperience(context: ProjectionContext): void {
  for (const phase of ["phase1", "phase2"] as const) {
    for (const participant of context.state.participants) {
      const requirement = getCombatRoundPhaseCombatExperienceRequirement({
        participantId: participant.participantId,
        phase,
        state: context.state,
      });
      const hasAction = phaseOpportunityPlans(context, phase).some(
        (entry) =>
          entry.plan.ownerParticipantId === participant.participantId && hasValidOpportunity(entry),
      );
      const resolved =
        getCombatRoundPhaseInitiativeChoice({
          participantId: participant.participantId,
          phase,
          state: context.state,
        }) !== undefined;
      const decision = participantDecision(
        context,
        participant.participantId,
        "phase_combat_experience",
        phase,
      );
      addFact(context, {
        completeness: requirement || !hasAction ? "complete" : "partial",
        ordering: "initiative_group",
        ownership: participantOwnership(
          context,
          participant.participantId,
          "phase_combat_experience",
          phase,
        ),
        participantId: participant.participantId,
        phase,
        processFamily: "phase_combat_experience",
        reason: resolved
          ? "already_resolved"
          : requirement
            ? "response_required"
            : hasAction
              ? "unresolved_choice"
              : "no_executable_phase_action",
        status: resolved
          ? "already_resolved"
          : requirement
            ? decision.status
            : hasAction
              ? "conditional"
              : "not_required",
        step: phase === "phase1" ? "phase1_ce" : "phase2_ce",
        workClass: resolved || !hasAction ? "no_work" : "human_decision",
      });
    }
  }
}

function pairOwnership(
  context: ProjectionContext,
  participantAId: string,
  participantBId: string,
  roleA: string,
  roleB: string,
): CombatParticipationOwnership {
  return {
    kind: "shared_pair",
    roles: [
      {
        authority: context.authorities.get(participantAId)?.authority ?? "unknown",
        participantId: participantAId,
        role: roleA,
      },
      {
        authority: context.authorities.get(participantBId)?.authority ?? "unknown",
        participantId: participantBId,
        role: roleB,
      },
    ],
  };
}

function projectRoundEnd(context: ProjectionContext): void {
  const review =
    context.state.roundEndReview?.roundNumber === context.state.roundNumber
      ? context.state.roundEndReview
      : undefined;
  const plan = buildCombatRoundEndProcessPlan(context.state);
  addFact(context, {
    ordering: "ownerless_boundary",
    ownership: { kind: "ownerless" },
    processFamily: "boundary",
    processId: plan.id,
    reason: review ? "already_resolved" : "deterministic_boundary",
    status: review ? "already_resolved" : "required",
    step: "prepare_round_end",
    workClass: review ? "no_work" : "deterministic_transition",
  });

  for (const contest of review?.continuedContactMaintenanceContests ?? []) {
    const roles = pairOwnership(
      context,
      contest.controllerParticipantId,
      contest.affectedParticipantId,
      "controller",
      "affected",
    );
    for (const side of [
      {
        participantId: contest.controllerParticipantId,
        recorded: contest.controllerRollRecorded,
      },
      { participantId: contest.affectedParticipantId, recorded: contest.affectedRollRecorded },
    ]) {
      const roll = participantRoll(context, side.participantId, "continued_contact");
      addFact(context, {
        completeness: contest.reviewRequiredReason ? "complete" : roll.completeness,
        ordering: "pair_order",
        ownership: roles,
        pairId: contest.continuedContactId,
        participantId: side.participantId,
        processFamily: "continued_contact",
        processId: contest.id,
        reason: side.recorded
          ? "already_resolved"
          : contest.reviewRequiredReason
            ? "stale_or_invalid_source"
            : "continued_contact_due",
        status: side.recorded
          ? "already_resolved"
          : contest.reviewRequiredReason
            ? "blocked"
            : roll.status,
        step: "maintenance_roll",
        workClass: side.recorded
          ? "no_work"
          : contest.reviewRequiredReason
            ? "human_decision"
            : roll.workClass,
      });
    }
  }

  for (const proposal of sortCombatRoundEndDistanceProposals(review?.proposedDistances ?? [])) {
    const ownership = pairOwnership(
      context,
      proposal.participantAId,
      proposal.participantBId,
      "participant_a",
      "participant_b",
    );
    for (const side of [proposal.participantA, proposal.participantB]) {
      const due = proposal.accepted && side.status === "pending";
      const resolved = side.status === "rolled" || side.status === "not_required";
      const roll = participantRoll(context, side.participantId, "distance_control");
      const opponentParticipantId =
        side.participantId === proposal.participantAId
          ? proposal.participantBId
          : proposal.participantAId;
      const legacyIncomplete =
        proposal.currentDistanceSource === undefined || side.calculationReadiness === undefined;
      const calculationIncomplete =
        proposal.currentDistanceSource === "compatibility_fallback" ||
        proposal.warnings.length > 0 ||
        side.warnings.length > 0 ||
        side.calculationReadiness?.completeness === "incomplete";
      addFact(context, {
        completeness: legacyIncomplete
          ? "legacy_incomplete"
          : calculationIncomplete
            ? "partial"
            : "complete",
        ordering: "pair_order",
        opponentParticipantId,
        ownership: roll.ownership,
        pairId: proposal.pairKey,
        participantId: side.participantId,
        processFamily: "distance_control",
        proposalId: proposal.id,
        reason: resolved ? "already_resolved" : due ? "distance_control_due" : "no_su_work",
        status: resolved ? "already_resolved" : due ? roll.status : "not_required",
        step: "distance_roll",
        workClass: resolved || !due ? "no_work" : roll.workClass,
      });
    }
    const commitReady =
      proposal.accepted &&
      proposal.status !== "committed" &&
      proposal.appliedDistance === undefined &&
      ["rolled", "review_ready"].includes(proposal.status);
    addFact(context, {
      ordering: proposal.controlMode === "continued_contact" ? "pair_order" : "ownerless_boundary",
      ownership: proposal.controlMode === "continued_contact" ? ownership : { kind: "gm_owned" },
      pairId: proposal.pairKey,
      processFamily: "distance_control",
      proposalId: proposal.id,
      reason:
        proposal.status === "committed" || proposal.appliedDistance !== undefined
          ? "already_resolved"
          : commitReady
            ? "distance_control_due"
            : "no_su_work",
      status:
        proposal.status === "committed" || proposal.appliedDistance !== undefined
          ? "already_resolved"
          : commitReady
            ? "required"
            : "conditional",
      step: "distance_commit",
      workClass:
        proposal.status === "committed" || proposal.appliedDistance !== undefined
          ? "no_work"
          : proposal.controlMode === "ordinary"
            ? "human_decision"
            : "human_decision",
    });
  }

  const pendingObservationAttempts = getPendingCombatObservationAttempts(context.state);
  for (const attempt of pendingObservationAttempts) {
    const roll = participantRoll(context, attempt.observerParticipantId, "observation");
    addFact(context, {
      opponentParticipantId: attempt.targetParticipantId,
      ordering: "participant_sequence",
      ownership: participantOwnership(context, attempt.observerParticipantId, "observation"),
      participantId: attempt.observerParticipantId,
      processFamily: "observation",
      processId: attempt.relationshipId,
      proposalId: attempt.attemptId,
      reason: "observation_attempt_due",
      status: roll.status,
      step: "observation_roll",
      workClass: roll.workClass,
    });
  }

  for (const participant of context.state.participants) {
    const participantReview = review?.participantReviews[participant.participantId];
    const healthRolls = participantReview?.proposedHealthRolls ?? [];
    if (healthRolls.length === 0) {
      addFact(context, {
        ownership: participantOwnership(context, participant.participantId, "health_bleed"),
        participantId: participant.participantId,
        processFamily: "health_bleed",
        reason: "no_su_work",
        status: "not_required",
        step: "health_check",
        workClass: "no_work",
      });
    } else {
      for (const health of healthRolls) {
        const due = health.accepted && health.status === "pending";
        const roll = participantRoll(context, participant.participantId, "health_bleed");
        addFact(context, {
          ownership: participantOwnership(context, participant.participantId, "health_bleed"),
          participantId: participant.participantId,
          processFamily: "health_bleed",
          proposalId: health.id,
          reason: due ? "health_check_due" : "already_resolved",
          status: due ? roll.status : "already_resolved",
          step: "health_check",
          workClass: due ? roll.workClass : "no_work",
        });
      }
    }

    const canonicalReview = participantReview?.canonicalReview;
    const unresolvedRequirements =
      canonicalReview?.requirements.filter((requirement) => !requirement.resolved) ?? [];
    const hasReviewDecision =
      unresolvedRequirements.length > 0 ||
      Boolean(canonicalReview?.proposals.some((proposal) => proposal.mayOverride));
    const hasAutomatic = Boolean(
      canonicalReview?.proposals.some((proposal) => proposal.automatic && !proposal.mayOverride),
    );
    const legacyWork = Boolean(
      (participantReview?.proposedDamage.length ?? 0) > 0 ||
      (participantReview?.proposedEffects.length ?? 0) > 0 ||
      (participantReview?.proposedRemovals.length ?? 0) > 0,
    );
    const complete = participantReview?.status === "complete";
    addFact(context, {
      completeness: canonicalReview
        ? canonicalReview.requirements.some(
            (requirement) => requirement.completeness !== "complete",
          )
          ? "legacy_incomplete"
          : "complete"
        : legacyWork
          ? "legacy_incomplete"
          : "complete",
      ordering: "participant_sequence",
      ownership: { kind: "gm_owned", participantId: participant.participantId },
      participantId: participant.participantId,
      processFamily: "effect_review",
      processId: canonicalReview?.reviewId,
      reason: complete
        ? "already_resolved"
        : hasReviewDecision || legacyWork
          ? "effect_review_required"
          : hasAutomatic
            ? "effect_review_required"
            : "no_su_work",
      status: complete
        ? "already_resolved"
        : hasReviewDecision || legacyWork
          ? unresolvedRequirements.some((requirement) => requirement.blocksReview)
            ? "blocked"
            : "required"
          : hasAutomatic
            ? "required"
            : "not_required",
      step: "SU_effect",
      workClass: complete
        ? "no_work"
        : hasReviewDecision || legacyWork
          ? "human_decision"
          : hasAutomatic
            ? "deterministic_transition"
            : "no_work",
    });

    const hasParticipantWork =
      healthRolls.some((health) => health.accepted && health.status === "pending") ||
      hasReviewDecision ||
      hasAutomatic ||
      legacyWork ||
      pendingObservationAttempts.some(
        (attempt) => attempt.observerParticipantId === participant.participantId,
      );
    const participantCompletionReady =
      participantReview?.status === "review_ready" && !hasParticipantWork;
    addFact(context, {
      ordering: "participant_sequence",
      ownership: { kind: "ownerless" },
      participantId: participant.participantId,
      processFamily: "participant_completion",
      reason: complete
        ? "already_resolved"
        : hasParticipantWork || participantCompletionReady
          ? "deterministic_boundary"
          : "no_su_work",
      status: complete
        ? "already_resolved"
        : participantCompletionReady
          ? "required"
          : hasParticipantWork
            ? "conditional"
            : "not_required",
      step: "SU_complete",
      workClass:
        complete || (!hasParticipantWork && !participantCompletionReady)
          ? "no_work"
          : "deterministic_transition",
    });
  }

  addFact(context, {
    ordering: "ownerless_boundary",
    ownership: { kind: "gm_owned" },
    processFamily: "boundary",
    processId: plan.id,
    reason: plan.complete ? "unresolved_choice" : "no_su_work",
    status: plan.complete ? "required" : "conditional",
    step: "round_boundary",
    workClass: plan.complete ? "human_decision" : "no_work",
  });
}

function projectPhaseBoundaries(context: ProjectionContext): void {
  const declarationReady = context.facts
    .filter((fact) =>
      ["combat_start_experience", "declaration"].includes(fact.identity.processFamily),
    )
    .every((fact) => ["already_resolved", "not_required"].includes(fact.status));
  addFact(context, {
    ordering: "ownerless_boundary",
    ownership: { kind: "ownerless" },
    processFamily: "boundary",
    reason: declarationReady ? "deterministic_boundary" : "unresolved_choice",
    status: declarationReady ? "required" : "conditional",
    step: "declaration_boundary",
    workClass: "deterministic_transition",
  });

  for (const phase of ["phase1", "phase2"] as const) {
    const reviewStep = phase === "phase1" ? "M1" : "M2";
    const modifierReady = context.facts
      .filter(
        (fact) =>
          fact.identity.processFamily === "modifier_review" && fact.identity.phase === phase,
      )
      .every((fact) => ["already_resolved", "not_required"].includes(fact.status));
    addFact(context, {
      ordering: "ownerless_boundary",
      ownership: { kind: "ownerless" },
      phase,
      processFamily: "boundary",
      reason: modifierReady ? "deterministic_boundary" : "modifier_review_required",
      status: modifierReady ? "required" : "conditional",
      step: `${reviewStep}_boundary`,
      workClass: "deterministic_transition",
    });
    const plans = phaseOpportunityPlans(context, phase);
    const complete = plans.every((entry) => entry.attack.completion.complete);
    addFact(context, {
      ordering: "ownerless_boundary",
      ownership: { kind: "ownerless" },
      phase,
      processFamily: "boundary",
      reason: complete ? "deterministic_boundary" : "no_executable_phase_action",
      status: complete ? "required" : "conditional",
      step: phase === "phase1" ? "phase1_boundary" : "phase2_boundary",
      workClass: "deterministic_transition",
    });
  }
}

/**
 * Builds one immutable active-round participation matrix. It classifies existing canonical work
 * but deliberately does not feed the result back into progression in Slice 1.
 */
export function projectCombatParticipation(
  input: CombatParticipationProjectionInput,
): CombatParticipationProjection {
  const active = activeCombatRoundStateSchema.parse(input.state);
  const state = combatRoundStateSchema.parse({ ...active, rounds: [] });
  if (!state.encounterId) throw new Error("Combat participation requires an encounter identity.");
  if (!input.encounterRevision)
    throw new Error("Combat participation requires a canonical revision.");
  const context: ProjectionContext = {
    actionPlans: buildCombatActionProcessPlans(state),
    authorities: new Map(
      input.participantAuthorities.map((source) => [source.participantId, source]),
    ),
    encounterId: state.encounterId,
    facts: [],
    input,
    proxies: input.proxyAuthorities ?? [],
    revision: input.encounterRevision,
    sequence: state.commands.length,
    state,
  };

  projectCombatStartExperience(context);
  projectDeclarations(context);
  projectModifierReviews(context);
  projectInitiative(context);
  projectActionProcesses(context);
  projectPhaseCombatExperience(context);
  projectRoundEnd(context);
  projectPhaseBoundaries(context);

  const projection = combatParticipationProjectionSchema.parse({
    encounterId: context.encounterId,
    encounterRevision: context.revision,
    facts: [...context.facts].sort((left, right) => left.id.localeCompare(right.id)),
    roundNumber: state.roundNumber,
    schemaVersion: CANONICAL_COMBAT_PARTICIPATION_SCHEMA_VERSION,
    sequence: context.sequence,
  });
  return freeze(projection);
}

/** Player projection keeps only owned facts and strips opponent, pair, proposal, and role identity. */
export function projectPlayerSafeCombatParticipation(input: {
  readonly controlledParticipantIds: ReadonlySet<string>;
  readonly projection: CombatParticipationProjection;
}): PlayerSafeCombatParticipationProjection {
  const facts = input.projection.facts
    .filter((fact) => {
      const participantId = fact.identity.participantId;
      return participantId !== undefined && input.controlledParticipantIds.has(participantId);
    })
    .map((fact) => ({
      completeness: fact.completeness,
      id: fact.id,
      identity: {
        encounterId: fact.identity.encounterId,
        encounterRevision: fact.identity.encounterRevision,
        participantId: fact.identity.participantId,
        phase: fact.identity.phase,
        processFamily: fact.identity.processFamily,
        roundNumber: fact.identity.roundNumber,
        sequence: fact.identity.sequence,
        step: fact.identity.step,
      },
      ordering: fact.ordering,
      ownership: {
        kind: fact.ownership.kind,
        participantId: fact.ownership.participantId,
      },
      reason: fact.reason,
      schemaVersion: fact.schemaVersion,
      status: fact.status,
      workClass: fact.workClass,
    }));
  return freeze(
    playerSafeCombatParticipationProjectionSchema.parse({
      encounterId: input.projection.encounterId,
      encounterRevision: input.projection.encounterRevision,
      facts,
      roundNumber: input.projection.roundNumber,
      schemaVersion: input.projection.schemaVersion,
      sequence: input.projection.sequence,
    }),
  );
}
